## General questions

### What can the design server be used for?

Our server can be used to design protein mutants and sequences end-to-end starting from a given target protein sequence, using evolutionarily related sequences and structures from the sequence family for conditional design.

You can analyze and inspect the designed sequence library with an interactive viewer application in the context of 3D structures and natural sequences.

After analyzing your generated library, you can also seamlessly export codon-optimized nucleotide sequences for experimental testing.

### Does the server cover de novo structure design?

Not yet, but we also plan to integrate de novo design methods in a future release. Our underlying design framework is able to accommodate these methods out of the box.

### Does the server cover non-protein molecules?

Not yet, but our design framework is agnostic to the type of biomolecule being designed (protein, DNA, RNA, small molecules). We plan to add such methods in a future release.

### What models are included?

Our server currently implements the following models:

1. an evolutionary model (EVmutation2), which models sequence probabilities conditioned on a family multiple sequence alignment
2. a large language model (ESM-2), which models sequence probabilities by training on large corpus of protein sequences

We plan to add key representatives from other classes of methods, e.g. inverse folding (ProteinMPNN/LigandMPNN) or de novo design of 3D structures with an established track record in the near future. We will also add more restraints/oracles for relevant biomolecular properties to optimize these properties jointly with scores from the zero-shot protein models listed above.

We invite the community to implement our design framework for existing and new methods to make these models fully interoperable to accelerate developments in the field.

### Is this server free to use?

Yes, the server is free to use for noncommercial and academic research. We will provide free compute jobs to our users as far as we are able to secure access to sufficient resources on our end, subject to the current challenging funding situation.

If you have spare GPU compute to donate to this project, please reach out to us\!

If you want to use the server commercially, please set up your own backend instance using the open source framework on your own infrastructure (to be released very soon).

### Will my free compute time be refilled?

Yes, we will refill your free compute time on a monthly basis. We aim to distribute the total compute resources available to us as fairly as possible across all of our users.

### Do I need to create an account?

No, you can use the server in public access mode without registration. This is assuming fair usage by everyone \- we reserve to require personal account registration in the future if we detect misuse. Creating your own account does offer a summary of all your previous jobs and your own compute budget on top, so please consider signing up nevertheless.

### Is the code open source?

Yes\! The underlying protein design framework and pipeline will be released as open source Python packages shortly. This will allow you to run design jobs on your own computing infrastructure or on cloud providers, and to review/extend the code as needed. The framework is designed to be agnostic to the type of model to accommodate all types of biomolecular design going forward.

### Are you looking for contributors?

Yes\! We are aiming to build a community to unify approaches for biomolecular modeling and design. This refers to further method development and integration, experimental validation, or any other useful contribution you can think of. We are also looking for sponsors supporting the development of new features. Please get in contact to discuss\!

## Submitting a design job

### What target sequence should I design?

You can design any protein sequence of interest, either by inputting a UniProt ID/name or the full amino acid sequence.The server will detect any evolutionarily related sequences and structures to optionally condition the design process and recommend appropriate models to do so.

### Should I limit the region of the protein that is modelled?

If your protein consists of multiple domains, you may want to consider limiting the modelled protein region to the parts relevant to the design problem (e.g. by not including the Fc region if designing antibody CDRs), as this will both speed up the computation and potentially can give more accurate results.

### What model should I use? / What properties do different zero-shot methods capture?

As a rule of thumb, to design functional proteins we recommend to use:

1. An evolutionary model if enough related sequences are available in the multiple sequence alignment (the server will check this for you and display an indication). You have control over the model predictions by selecting which evolutionary sequences to use for modelling with the taxonomy filter (accessible through the "Filter" button)
2. a large language model if the multiple sequence alignment contains few sequences (use for CDR designs, de novo proteins, etc.; note that these models also degrade in performance as fewer evolutionary related sequences are available at training time).

Evolutionary models and large language models typically score and optimize for the joint functional properties the natural sequences in the related protein family were selected for in evolution (this is typically an aggregate of folding into a stable molecule, enzymatic activity, etc.). These models are typically best for predicting the overall function/fitness effect of mutations, but usually do not work well to predict different/novel functions not present in the natural sequences. Inverse folding models tend to predict protein stability the most accurately, but tend to fail in capturing protein function.

Which different categories of protein function (e.g. overall fitness/function, stability alone, ...) are predicted best by different classes of zero-shot models are still a topic of ongoing research. We refer to the ProteinGym benchmark ([proteingym.org](http://proteingym.org)) for more detail and performance assessments on different prediction categories.

We plan to add explicit predictors for different biochemical and functional properties (e.g. melting temperature, or user-uploaded assay data) in the future for more fine-grained control over the design process.

### What design approach should I use?

* Single mutation scan: This mode predicts all single mutations for the target sequence. Use this mode if you want to get an overview of mutable/conserved regions in your molecule for further design, quantitatively predict single mutant effects, or to design single mutant libraries. Note that individually conserved positions could still be mutable with higher-order mutations due to epistatic interactions.
* Autoregressive sampling: Use this mode for fast sampling from models to generate larger numbers of sequences that can potentially be very distant from the target sequence. There is only limited control over how sequences will be generated (e.g. fixing positions or selection sampling temperature).
* Restrained Gibbs sampling: Use this mode for slower, more controllable sampling from models considering the full sequence context. It currently allows control over distance to target sequence with a weighted sequence distance restraint. More restraint types/oracles to follow in the future.

### How can I control the diversity of generated sequences?

You can control the diversity of the generated sequences with the following settings:

1. Sampling temperature (available for autoregressive sampling and Gibbs sampling): Higher sampling temperatures introduce mutations more aggressively, whereas lower sampling temperatures do so more conservatively. The default temperature (T=0.5) is a balance between these cases.
2. Distance restraint (available for Gibbs sampling only): You can penalize or reward the introduction of mutations relative to the target sequence by adding a sequence distance restraint. A high negative restraining weight will enforce the generated sequences to be more similar to the target sequence, whereas a high positive weight will enforce the sequences to be more distant to the target sequence.
3. Modified positions: If there are positions you want to avoid changing, you can fix them to the wild-type residue to limit the introduced sequence variation.

We recommend exploring different settings to achieve the desired diversity of your designed library, as the optimal setting for the desired outcome may vary between different protein families.

### How are sequences and structures gathered?

Evolutionary sequences related to the target sequence are identified using the MMseqs2 ColabFold server. Retrieved sequences can be filtered based on taxonomic information with the TaxoView plugin to control the behaviour of evolutionary sequence models.

3D structures from the PDB and predicted structure models from AFDB are identified using the FoldSeek server with a predicted 3Di string for the target sequence.

## Analyzing the results

### What do the scores mean and how do I compare designs relative to each other?

The scores assigned to single mutants and designs are log-likelihood scores relative to the target (wild-type) sequence:

* Score \< 0 means a sequence/mutant is less likely than the target sequence (damaging effect),
* Score \> 0 means a sequence/mutant it is more likely (beneficial effect)
* Score of 0 means that the sequence/mutant is equally probable as the target sequence (neutral effect)

For local mutation neighborhoods (singles, doubles, ...) these scores have been shown to quantitatively correlate with experimentally measured effects of mutations (Hopf et al., Nature Biotech 2017; Riesselmann et al., Nature Methods 2018; Notin et al., NeurIPS 2023, [proteingym.org](http://proteingym.org)).

Comparing effect scores across different mutational depths is still an ongoing topic of research, so quantitatively comparing the score of a single mutant to a sequence with 30 of its amino acids changed may not be meaningful. For design jobs (autoregressive sampling and Gibbs sampling), therefore please also make note of the mutation distance column when analyzing scores and prioritize sufficient sequence diversity across your library in addition to high scores.

### How do I interact with the designs in the user interface?

Use the interactive result viewer to analyze the properties of your generated sequence library, and to select subsets of designs to export for experimental testing.

You can disable any of the following panels by clicking the "Panels" button and resizing the other panels to assign them more space on the screen.

Note: *If you switch between selection by mutation (e.g. in the heatmap) and selection by design (e.g. in the table), the current selection will be logged in as a filter and the next selections will be against that subset*. Use the "Reset filter" button to start selecting from scratch.

#### Table view

Clicking a row will select the corresponding sequence (individual design for design jobs, or single mutant sequence for single mutation scans). For design jobs, all changed positions in the currently selected design will be highlighted as sticks in the 3D structure panel and with little black dots in the heatmap viewer. Hold the shift key while clicking to select a consecutive range of designs/mutants, or hold the command/control key to add or remove individual designs/mutants.

You can sort the order of the table by clicking on the respective column headers, e.g. to display all sequences with high scores or high mutational distance first.

Hover over the eye icon to view the full sequence, with all positions changed relative to the target sequence highlighted in orange.

Click the copy icon to copy the full design sequence to the clipboard.

Note: If multiple designs/mutants are selected in another panel, the table will only display that current selected subset.

#### Mutation heatmap

Displayed information depends on whether looking at the results for a design job or a single mutation scan:

* For single mutation scans, displays the quantitative log-odds score relative to the target sequence for each possible substitution in each position. Each heatmap cell corresponds to exactly one mutant sequence, which will be selected when clicking the cell.
* For design jobs, each heatmap cell shows the percentage of sequences that contain the particular amino acid in that position. The displayed frequencies are updated live based on the currently active selection of designs from other panels. If clicking a heatmap cell, any sequences with that amino acid in the position will be selected.

Use the command/control key for multiple selection. Selecting multiple amino acids in the same position acts as an "or" filter, selecting multiple mutations in different positions acts as an "and" filter. For example, this functionality can be used to select all designs that retain a given combination of active site residues.

Clicking on the position label for each column (x-axis) will select all available mutations *but* the WT residue in the target sequence (i.e., all sequences that were changed relative to the target sequence in that position; in the case of fully conserved positions nothing will be selected). If you hold the alt key while clicking, the WT residue will be selected instead.

#### 3D structure viewer

Displays positional information about designs on top of related 3D structures (select with the dropdown menu, these are automatically gathered for you using FoldSeek from PDB biological assembly and AFDB structures, ranked by alignment score starting with closest sequences first):

* For single mutation scans, the average positional mutation effect
* For design jobs, the percentage of sequences that were changed relative to the target sequence (color code from blue/few changes relative to target to white/highly mutated relative to target)

Selected mutations will be additionally displayed as spheres on top of the cartoon representation, with colors corresponding to the same properties as above but just for that subset of substitutions per position.

Clicking on a position in the structure will select all available non-WT substitutions for that position (nothing will happen if all sequences have the WT amino acid). Hold the alt key to select the WT substitution in that position instead.

Use the command/control key for multiple selection across different positions; this will act as an "and" filter just like in the heatmap.

Note that any residues not covered by the target sequence region will be colored in gray.

#### Sequence space viewer (design jobs only)

Displays overall topology of sequence space of designs and natural sequences by projecting designs to 2D space based on their mutual sequence identity, where similar sequences will be placed more closely together. Allows to identify subsets of designs e.g. more similar to each other or to certain subfamilies of the natural protein families.

Use the mouse wheel to zoom the plot, or draw a rectangle while holding the alt key to zoom to that area.

Select individual designs by clicking on the respective data point. Hold the mouse button and draw a rectangle to select multiple designs at once. Press the command/control key while selecting with the mouse to add or remove these points from the current selection.

Individual designs can be colored by different quantitative properties like score or mutation distance to the target sequence. Select the desired property in the dropdown menu in the top right of the panel.

### How do I select designs for download and DNA sequence generation?

Any sequences that should be retained for downloading or DNA sequence generation can be added to the basket by clicking on the "+" button. Similarly, clicking "-" will remove those designs from the basket again.

*Note: If no subset of designs/mutants is currently selected, the full set will be added to the basket*.

Click on "Basket" to make all sequences in the basket the currently active selection.

Click on "Build DNA..." to proceed and generate codon-optimized sequences for your selected library.

## Building DNA sequences

### Do I need to specify flanking sequences?

Specifying the fixed DNA sequences upstream and downstream of the DNA sequence generated for you from the design is optional, but strongly advised for the following reasons:

* Used as context to avoid introduction of restriction site motifs, repeats, etc.
* If start/stop codons are present in the upstream/downstream sequences, the server will verify the integrity of the ORF or display a warning instead

### How do I resolve failing optimization jobs?

If your DNA generation job fails, this is typically due to strict constraints that cannot be satisfied by the codon optimizer (e.g. too tight GC content range/window). We recommend resubmitting with relaxed settings in this case.

### Why should I optimize sequences relative to the target?

This setting is advisable if you want to control for unnecessary codon changes as far as possible, by only optimizing positions that are different to the target sequence.

You can specify an existing DNA sequence for your target if available, otherwise the server will create a full codon-optimized DNA sequence first. Afterwards, only positions that need to be changed to code for the mutations in each of the designs will be codon-optimized.

### What tool is used to perform codon optimization?

We use the well-established DNA Chisel Python package under the hood to perform codon optimization.
