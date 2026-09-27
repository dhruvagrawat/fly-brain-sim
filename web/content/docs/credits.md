# Credits and citations

Flybrain is designed and built by **Dhruv Agrawat** ([@dhruvagrawat](https://github.com/dhruvagrawat)). The simulator, lab, visualisation, command center and site are original work. The science underneath belongs to the people below. If you use Flybrain in research, please cite them.

## Connectome

**FlyWire consortium.** Dorkenwald, S., Matsliah, A., Sterling, A. R., et al. *Neuronal wiring diagram of an adult brain.* Nature 634, 124–138 (2024). [doi:10.1038/s41586-024-07558-y](https://doi.org/10.1038/s41586-024-07558-y)

**Cell types and annotations.** Schlegel, P., Yin, Y., Bates, A. S., et al. *Whole-brain annotation and multi-connectome cell typing of Drosophila.* Nature 634, 139–152 (2024). [doi:10.1038/s41586-024-07686-5](https://doi.org/10.1038/s41586-024-07686-5). Data: [flyconnectome/flywire_annotations](https://github.com/flyconnectome/flywire_annotations).

**Neurotransmitter predictions.** Eckstein, N., Bates, A. S., Champion, A., et al. *Neurotransmitter classification from electron microscopy images at synaptic sites in Drosophila melanogaster.* Cell 187, 2574–2594 (2024).

**Imaging.** Zheng, Z., Lauritzen, J. S., Perlman, E., et al. *A complete electron microscopy volume of the brain of adult Drosophila melanogaster.* Cell 174, 730–743 (2018).

## Model

**Whole-brain LIF model.** Shiu, P. K., Sterne, G. R., Spiller, N., et al. *A Drosophila computational brain model reveals sensorimotor processing.* Nature 634, 210–219 (2024). [doi:10.1038/s41586-024-07763-9](https://doi.org/10.1038/s41586-024-07763-9). Code and packaged connectivity: [philshiu/Drosophila_brain_model](https://github.com/philshiu/Drosophila_brain_model) (MIT licence). Flybrain reimplements this model independently, and its parameters follow the paper exactly.

Parameter sources cited in the model: Kakaria & de Bivort 2017; Jürgensen et al. 2021; Lazar et al. 2021; Paul et al. 2015.

## Software

NumPy, pandas, PyArrow, Numba, Next.js, React, marked, and the Bricolage Grotesque and Chivo typefaces (SIL Open Font License).

## Data licences

Connectome data is downloaded at runtime from its original sources, and the full dataset is not redistributed in this repository. The small derived files in `web/public/data/` (neuron positions, classes and recorded simulation results) are included so the website works on its own. Please respect the original licences and FlyWire's terms when reusing them.
