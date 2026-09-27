"""Leaky integrate-and-fire model of the whole fly brain.

Reimplements the model of Shiu et al. (2024) in NumPy + Numba (no Brian2), so a
1 s trial of all ~139k neurons runs in seconds on a laptop CPU.

Per neuron:
    dv/dt = (v_0 - v + g) / t_mbr
    dg/dt = -g / tau
A presynaptic spike adds w_syn * (signed synapse count) to g of every target after
a delay t_dly. Crossing v_th emits a spike, resets v and g, and starts a refractory
period t_rfc. Stimulated neurons receive Poisson kicks of w_syn * f_poi to v.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
from numba import njit

from .data import Connectome


@dataclass
class Params:
    t_run: float = 1000.0  # ms, trial duration
    n_run: int = 30        # number of trials
    dt: float = 0.1        # ms, integration step
    v_0: float = -52.0     # mV, resting potential
    v_rst: float = -52.0   # mV, reset potential
    v_th: float = -45.0    # mV, spike threshold
    t_mbr: float = 20.0    # ms, membrane time constant
    tau: float = 5.0       # ms, synaptic time constant
    t_rfc: float = 2.2     # ms, refractory period
    t_dly: float = 1.8     # ms, synaptic delay
    w_syn: float = 0.275   # mV per synapse
    r_poi: float = 150.0   # Hz, Poisson rate for stimulated neurons
    f_poi: float = 250.0   # Poisson kick = w_syn * f_poi
    seed: int = 0


@dataclass
class Result:
    """Spikes from a simulation. neuron/time/trial are parallel arrays."""

    neuron: np.ndarray   # model index
    time: np.ndarray     # ms
    trial: np.ndarray
    params: Params
    flywire_ids: np.ndarray
    truncated: bool = False
    meta: dict = field(default_factory=dict)

    def rates(self) -> "pd.DataFrame":
        """Mean firing rate (Hz) and SD across trials for every neuron that spiked."""
        import pandas as pd

        p = self.params
        counts = np.zeros((len(self.flywire_ids), p.n_run), dtype=np.int32)
        np.add.at(counts, (self.neuron, self.trial), 1)
        active = np.nonzero(counts.sum(1))[0]
        hz = counts[active] / (p.t_run / 1000.0)
        df = pd.DataFrame(
            {
                "flywire_id": self.flywire_ids[active],
                "rate_hz": hz.mean(1),
                "std_hz": hz.std(1),
            }
        )
        return df.sort_values("rate_hz", ascending=False, ignore_index=True)


@njit(cache=True)
def _run_trial(indptr, post, weight, n, steps, delay_steps, rfc_steps,
               dv_decay, dg_decay, g_to_v, v_0, v_rst, v_th, w_syn,
               stim_idx, stim_prob, stim_kick, silenced, seed, max_spikes):
    np.random.seed(seed)
    v = np.full(n, v_0, dtype=np.float64)
    g = np.zeros(n, dtype=np.float64)
    ref_end = np.zeros(n, dtype=np.int64)
    ring_len = delay_steps + 1
    ring = np.zeros((ring_len, n), dtype=np.float64)
    no_rfc = np.zeros(n, dtype=np.bool_)
    for k in range(stim_idx.size):
        no_rfc[stim_idx[k]] = True

    out_n = np.empty(max_spikes, dtype=np.int32)
    out_t = np.empty(max_spikes, dtype=np.int32)
    n_out = 0
    truncated = False

    for t in range(steps):
        slot = t % ring_len
        # 1. deliver delayed synaptic input
        buf = ring[slot]
        for i in range(n):
            if buf[i] != 0.0:
                g[i] += buf[i]
                buf[i] = 0.0
        # 2. Poisson stimulation (acts directly on v)
        for k in range(stim_idx.size):
            if np.random.random() < stim_prob[k]:
                v[stim_idx[k]] += stim_kick
        # 3. integrate (exact solution of the linear v-g system), threshold, reset
        for i in range(n):
            if t < ref_end[i]:
                continue
            gi = g[i]
            u = v[i] - v_0
            v[i] = v_0 + (u - g_to_v * gi) * dv_decay + g_to_v * gi * dg_decay
            g[i] = gi * dg_decay
            if v[i] > v_th:
                v[i] = v_rst
                g[i] = 0.0
                if not no_rfc[i]:
                    ref_end[i] = t + 1 + rfc_steps
                if n_out < max_spikes:
                    out_n[n_out] = i
                    out_t[n_out] = t
                    n_out += 1
                else:
                    truncated = True
                if silenced[i]:
                    continue
                target = (t + delay_steps) % ring_len
                row = ring[target]
                for e in range(indptr[i], indptr[i + 1]):
                    row[post[e]] += w_syn * weight[e]
    return out_n[:n_out].copy(), out_t[:n_out].copy(), truncated


def simulate(con: Connectome, stimulate=(), silence=(), params: Params | None = None,
             stim_rates=None, max_spikes_per_trial: int = 20_000_000, verbose: bool = True) -> Result:
    """Run n_run trials.

    stimulate  -- FlyWire IDs driven with Poisson input at params.r_poi (or stim_rates, Hz each)
    silence    -- FlyWire IDs whose outgoing synapses are removed
    """
    import time

    p = params or Params()
    n = con.n_neurons
    stim_idx = con.index_of(stimulate) if len(stimulate) else np.zeros(0, np.int64)
    rates = np.full(stim_idx.size, p.r_poi, dtype=np.float64) if stim_rates is None \
        else np.asarray(stim_rates, dtype=np.float64)
    stim_prob = rates * p.dt / 1000.0
    silenced = np.zeros(n, dtype=np.bool_)
    if len(silence):
        silenced[con.index_of(silence)] = True

    steps = int(round(p.t_run / p.dt))
    delay_steps = int(round(p.t_dly / p.dt))
    rfc_steps = int(round(p.t_rfc / p.dt))
    dv_decay = np.exp(-p.dt / p.t_mbr)
    dg_decay = np.exp(-p.dt / p.tau)
    g_to_v = p.tau / (p.tau - p.t_mbr)  # particular-solution coefficient

    ns, ts, rs, truncated = [], [], [], False
    for trial in range(p.n_run):
        t0 = time.time()
        nn, tt, tr = _run_trial(
            con.indptr, con.post, con.weight, n, steps, delay_steps, rfc_steps,
            dv_decay, dg_decay, g_to_v, p.v_0, p.v_rst, p.v_th, p.w_syn,
            stim_idx, stim_prob, p.w_syn * p.f_poi, silenced,
            p.seed * 100_003 + trial, max_spikes_per_trial,
        )
        truncated |= tr
        ns.append(nn)
        ts.append(tt * p.dt)
        rs.append(np.full(nn.size, trial, dtype=np.int32))
        if verbose:
            print(f"  trial {trial + 1}/{p.n_run}: {nn.size:,} spikes ({time.time() - t0:.1f}s)", flush=True)

    return Result(np.concatenate(ns), np.concatenate(ts), np.concatenate(rs), p, con.flywire_ids, truncated)
