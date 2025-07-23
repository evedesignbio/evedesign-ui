import { Button, Modal, Stack } from "@mantine/core";
import { Sequence } from "../../models/design.ts";
import 'taxoview/dist/taxoview.ce.js';
import { useCallback, useState } from "react";

export interface TaxoviewModalProps {
  opened: boolean;
  close: () => void;
  msa: Sequence[]; // TODO: change to mmseqs taxonomyreport output as a string 
  submit: (filteredTaxonIds: number[]) => void; 
}

// dummy data
const taxonomyData = `#clade_proportion	clade_count	taxon_count	rank	taxID	name
5.9001	32656	32656	no rank	0	unclassified
94.0999	520822	4	no rank	1	root
90.8851	503029	0	superkingdom	10239	  Viruses
90.8511	502841	0	clade	2559587	    Riboviria
90.8511	502841	0	kingdom	2732396	      Orthornavirae
90.8110	502619	0	phylum	2732408	        Pisuviricota
90.8110	502619	0	class	2732506	          Pisoniviricetes
90.8108	502618	0	order	76804	            Nidovirales
90.8108	502618	0	suborder	2499399	              Cornidovirineae
90.8108	502618	1	family	11118	                Coronaviridae
90.8101	502614	4	subfamily	2501931	                  Orthocoronavirinae
90.8063	502593	2	genus	694002	                    Betacoronavirus
90.8034	502577	897	subgenus	2509511	                      Sarbecovirus
90.6358	501649	2102	species	694009	                        Severe acute respiratory syndrome-related coronavirus
90.2115	499301	499301	no rank	2697049	                          Severe acute respiratory syndrome coronavirus 2
0.0444	246	0	no rank	2901879	                          Severe acute respiratory syndrome coronavirus
0.0444	246	246	no rank	227984	                            SARS coronavirus Tor2
0.0056	31	0	no rank	2720068	                        unclassified Sarbecovirus
0.0056	31	31	species	864596	                          Bat coronavirus BM48-31/BGR/2008
0.0009	5	0	subgenus	2509486	                      Hibecovirus
0.0009	5	0	species	2501961	                        Bat Hp-betacoronavirus Zhejiang2013
0.0009	5	5	no rank	1541205	                          Bat Hp-betacoronavirus/Zhejiang2013
0.0007	4	2	subgenus	2509481	                      Embecovirus
0.0002	1	0	species	694003	                        Betacoronavirus 1
0.0002	1	1	no rank	31631	                          Human coronavirus OC43
0.0002	1	0	species	694005	                        Murine coronavirus
0.0002	1	0	no rank	31632	                          Rat coronavirus
0.0002	1	1	no rank	502102	                            Rat coronavirus Parker
0.0005	3	0	subgenus	2509494	                      Merbecovirus
0.0002	1	1	species	694007	                        Tylonycteris bat coronavirus HKU4
0.0002	1	1	species	694008	                        Pipistrellus bat coronavirus HKU5
0.0002	1	1	species	1335626	                        Middle East respiratory syndrome-related coronavirus
0.0004	2	0	subgenus	2509502	                      Nobecovirus
0.0004	2	0	species	2501962	                        Rousettus bat coronavirus GCCDC1
0.0004	2	2	no rank	1892416	                          Rousettus bat coronavirus
0.0018	10	2	genus	693996	                    Alphacoronavirus
0.0004	2	0	no rank	366617	                      unclassified Alphacoronavirus
0.0004	2	2	species	1906673	                        Alphacoronavirus sp.
0.0004	2	0	subgenus	2509492	                      Luchacovirus
0.0004	2	0	no rank	2724758	                        unclassified Luchacovirus
0.0004	2	2	species	1964806	                          Coronavirus AcCoV-JC34
0.0002	1	0	subgenus	2509477	                      Colacovirus
0.0002	1	0	species	1913643	                        Bat coronavirus CDPHE15
0.0002	1	1	no rank	1384461	                          Bat coronavirus CDPHE15/USA/2006
0.0002	1	0	subgenus	2509480	                      Duvinacovirus
0.0002	1	0	species	11137	                        Human coronavirus 229E
0.0002	1	1	no rank	1699095	                          Camel alphacoronavirus
0.0002	1	0	subgenus	2509496	                      Minacovirus
0.0002	1	1	species	1264898	                        Ferret coronavirus
0.0002	1	0	subgenus	2509505	                      Pedacovirus
0.0002	1	1	species	28295	                        Porcine epidemic diarrhea virus
0.0011	6	0	genus	1159901	                    Deltacoronavirus
0.0007	4	0	subgenus	2509474	                      Buldecovirus
0.0005	3	3	species	1159902	                        Common moorhen coronavirus HKU21
0.0002	1	1	species	1159907	                        White-eye coronavirus HKU16
0.0004	2	0	subgenus	2509469	                      Andecovirus
0.0004	2	2	species	1159908	                        Wigeon coronavirus HKU20
0.0002	1	0	genus	694013	                    Gammacoronavirus
0.0002	1	0	no rank	1433214	                      unclassified Gammacoronavirus
0.0002	1	1	species	2569586	                        Canada goose coronavirus
0.0005	3	0	subfamily	693995	                  Coronavirinae
0.0005	3	0	no rank	2664420	                    unclassified Coronavirinae
0.0005	3	3	species	1508220	                      Bat coronavirus
0.0002	1	0	order	464095	            Picornavirales
0.0002	1	0	family	232795	              Dicistroviridae
0.0002	1	0	genus	144051	                Cripavirus
0.0002	1	0	species	3048297	                  Cripavirus ropadi
0.0002	1	1	no rank	66834	                    Rhopalosiphum padi virus
0.0401	222	0	phylum	2732407	        Lenarviricota
0.0401	222	0	class	2842243	          Leviviricetes
0.0401	222	0	order	2842249	            Timlovirales
0.0401	222	0	family	2842332	              Steitzviridae
0.0202	112	0	genus	2842702	                Gihfavirus
0.0202	112	0	species	2844652	                  Gihfavirus pelohabitans
0.0202	112	112	no rank	2786405	                    ssRNA phage SRR5466369_2
0.0199	110	0	genus	2842802	                Kinglevirus
0.0199	110	0	species	2845070	                  Kinglevirus lutadaptatum
0.0199	110	110	no rank	2786389	                    ssRNA phage SRR5466337_3
0.0193	107	0	clade	2731342	    Monodnaviria
0.0193	107	0	kingdom	2732092	      Shotokuvirae
0.0193	107	0	phylum	2732415	        Cossaviricota
0.0193	107	0	class	2732422	          Quintoviricetes
0.0193	107	0	order	2732534	            Piccovirales
0.0193	107	0	family	10780	              Parvoviridae
0.0193	107	0	subfamily	2732887	                Hamaparvovirinae
0.0193	107	0	genus	2733231	                  Chaphamaparvovirus
0.0193	107	0	species	3052108	                    Chaphamaparvovirus galliform3
0.0193	107	107	no rank	2849623	                      chicken chapparvovirus HK
0.0145	80	0	clade	2731341	    Duplodnaviria
0.0145	80	0	kingdom	2731360	      Heunggongvirae
0.0145	80	0	phylum	2731618	        Uroviricota
0.0145	80	1	class	2731619	          Caudoviricetes
0.0060	33	0	genus	2560142	            Gorganvirus
0.0060	33	0	species	2560650	              Gorganvirus isfahan
0.0060	33	33	no rank	1969841	                Proteus phage VB_PmiS-Isfahan
0.0016	9	0	genus	186789	            Punavirus
0.0014	8	0	species	2560452	              Punavirus RCS47
0.0014	8	8	no rank	1590550	                Escherichia phage RCS47
0.0002	1	0	species	2560732	              Punavirus SJ46
0.0002	1	1	no rank	1815968	                Salmonella phage SJ46
0.0013	7	0	family	2731643	            Autographiviridae
0.0013	7	1	subfamily	2731652	              Slopekvirinae
0.0009	5	0	genus	2732938	                Koutsourovirus
0.0009	5	0	species	2733608	                  Koutsourovirus KDA1
0.0009	5	5	no rank	1147139	                    Enterobacter phage phiKDA1
0.0002	1	1	genus	1920774	                Drulisvirus
0.0007	4	0	genus	2843425	            Muldoonvirus
0.0007	4	0	species	2846182	              Muldoonvirus muldoon
0.0007	4	4	no rank	2601678	                Serratia phage Muldoon
0.0005	3	0	genus	1982104	            Decurrovirus
0.0005	3	0	species	1982105	              Decurrovirus decurro
0.0005	3	3	no rank	1698361	                Arthrobacter phage Decurro
0.0005	3	0	no rank	2788787	            unclassified Caudoviricetes
0.0002	1	1	species	1150991	              Sphingomonas phage PAU
0.0002	1	1	species	1327993	              Cellulophaga phage phi39:1
0.0002	1	1	species	2851069	              Curtobacterium phage Reje
0.0004	2	0	genus	2843376	            Donellivirus
0.0004	2	0	species	1084719	              Donellivirus gee
0.0004	2	2	no rank	2884420	                Bacillus phage G
0.0004	2	0	family	2946167	            Peduoviridae
0.0002	1	0	genus	2732990	              Seongnamvirus
0.0002	1	0	species	2734073	                Seongnamvirus ESSI2
0.0002	1	1	no rank	947842	                  Cronobacter phage ESSI-2
0.0002	1	0	genus	2948723	              Gegevirus
0.0002	1	0	species	2955944	                Gegevirus ST437OXA245phi41
0.0002	1	1	no rank	2510486	                  Klebsiella phage ST437-OXA245phi4.1
0.0004	2	0	genus	3044690	            Cobrasixvirus
0.0004	2	0	species	3059893	              Cobrasixvirus cobrasix
0.0004	2	2	no rank	2894794	                Enterobacter phage vB_EclS_CobraSix
0.0002	1	1	genus	1623292	            Omegavirus
0.0002	1	0	genus	1921525	            Kleczkowskavirus
0.0002	1	1	species	1921526	              Kleczkowskavirus RHEph4
0.0002	1	0	genus	1982367	            Pepyhexavirus
0.0002	1	0	species	1982369	              Pepyhexavirus poco6
0.0002	1	1	no rank	691964	                Rhodococcus phage ReqiPoco6
0.0002	1	0	family	2560065	            Herelleviridae
0.0002	1	0	subfamily	857473	              Spounavirinae
0.0002	1	0	genus	1918721	                Siminovitchvirus
0.0002	1	0	species	1918722	                  Siminovitchvirus CP51
0.0002	1	1	no rank	1391188	                    Bacillus phage CP-51
0.0002	1	0	genus	2560237	            Thornevirus
0.0002	1	0	species	2560336	              Thornevirus SP15
0.0002	1	1	no rank	1792032	                Bacillus phage SP-15
0.0002	1	0	family	2731690	            Demerecviridae
0.0002	1	0	subfamily	2732012	              Ermolyevavirinae
0.0002	1	0	genus	2948922	                Thalassavirus
0.0002	1	0	species	2956515	                  Thalassavirus river4
0.0002	1	1	no rank	2736288	                    Vibrio phage River4
0.0002	1	0	genus	2733127	            Rosemountvirus
0.0002	1	0	species	2846142	              Rosemountvirus yarpen
0.0002	1	1	no rank	2713327	                Salmonella phage yarpen
0.0002	1	0	subfamily	2842523	            Bronfenbrennervirinae
0.0002	1	1	genus	2842946	              Peeveelvirus
0.0002	1	0	genus	2843375	            Dinavirus
0.0002	1	0	species	2846739	              Dinavirus dina
0.0002	1	1	no rank	2759732	                Ralstonia phage Dina
0.0002	1	0	family	2943001	            Casjensviridae
0.0002	1	0	genus	2943003	              Cenphatecvirus
0.0002	1	0	species	2955599	                Cenphatecvirus saba
0.0002	1	1	no rank	2596672	                  Proteus phage Saba
0.0002	1	0	family	2946160	            Kyanoviridae
0.0002	1	0	genus	2948904	              Shandvirus
0.0002	1	0	species	2956438	                Shandvirus sb64
0.0002	1	1	no rank	2163901	                  Synechococcus phage S-B64
0.0002	1	0	genus	2948642	            Buchananvirus
0.0002	1	0	species	2955547	              Buchananvirus Sa179lw
0.0002	1	1	no rank	2126819	                Escherichia phage vB_EcoS Sa179lw
0.0002	1	0	genus	2948764	            Immutovirus
0.0002	1	0	species	2955989	              Immutovirus immuto
0.0002	1	1	no rank	2801477	                Flavobacterium phage vB_FspM_immuto_2-6A
0.0002	1	1	family	3044479	            Stanwilliamsviridae
0.0002	1	0	clade	2732004	    Varidnaviria
0.0002	1	0	kingdom	2732005	      Bamfordvirae
0.0002	1	0	phylum	2732007	        Nucleocytoviricota
0.0002	1	0	class	2732523	          Megaviricetes
0.0002	1	0	order	2732524	            Algavirales
0.0002	1	0	family	10501	              Phycodnaviridae
0.0002	1	0	genus	181086	                Prymnesiovirus
0.0002	1	0	no rank	358403	                  unclassified Prymnesiovirus
0.0002	1	1	species	251749	                    Phaeocystis globosa virus
3.2140	17789	0	no rank	131567	  cellular organisms
3.2140	17789	0	superkingdom	2759	    Eukaryota
3.2140	17789	0	clade	33154	      Opisthokonta
3.2140	17789	0	kingdom	33208	        Metazoa
3.2140	17789	0	clade	6072	          Eumetazoa
3.2140	17789	0	clade	33213	            Bilateria
3.2140	17789	0	clade	33511	              Deuterostomia
3.2140	17789	0	phylum	7711	                Chordata
3.2140	17789	0	subphylum	89593	                  Craniata
3.2140	17789	0	clade	7742	                    Vertebrata
3.2140	17789	0	clade	7776	                      Gnathostomata
3.2140	17789	0	clade	117570	                        Teleostomi
3.2140	17789	0	clade	117571	                          Euteleostomi
3.2140	17789	0	superclass	8287	                            Sarcopterygii
3.2140	17789	0	clade	1338369	                              Dipnotetrapodomorpha
3.2140	17789	0	clade	32523	                                Tetrapoda
3.2140	17789	0	clade	32524	                                  Amniota
3.2140	17789	0	class	40674	                                    Mammalia
3.2140	17789	0	clade	32525	                                      Theria
3.2140	17789	0	clade	9347	                                        Eutheria
3.2140	17789	0	clade	1437010	                                          Boreoeutheria
3.2140	17789	0	superorder	314146	                                            Euarchontoglires
3.2140	17789	0	order	9443	                                              Primates
3.2140	17789	0	suborder	376913	                                                Haplorrhini
3.2140	17789	0	infraorder	314293	                                                  Simiiformes
3.2140	17789	0	parvorder	9526	                                                    Catarrhini
3.2140	17789	0	superfamily	314295	                                                      Hominoidea
3.2140	17789	0	family	9604	                                                        Hominidae
3.2140	17789	0	subfamily	207598	                                                          Homininae
3.2140	17789	0	genus	9605	                                                            Homo
3.2140	17789	17789	species	9606	                                                              Homo sapiens
`;

export const TaxoviewModal = ({
  opened,
  msa,
  close,
  submit,
}: TaxoviewModalProps) => {
	// State for clicked taxon IDs
	const [selectedIds, setSelectedIds] = useState<number[]>([]);

	const setTaxoEl = useCallback(
		(el: HTMLElement | null) => {
			if (!el) return; // unmounted

			const onNodeClicked = (e: Event) => {
				const [node] = (e as CustomEvent).detail as [any];
				console.log("clicked node:", node.taxon_id);

				// Add selected node's taxon_id to list
				const id = node.taxon_id ?? node.taxID;
				if (id == null) return;
				setSelectedIds(
					(prev) => (prev.includes(id) ? prev : [...prev, id]) // avoid duplicates
				);
			};

			// @ts-ignore
			// el.colorScheme = ["#FFCD73", "#8CB5B5", "#648FFF", "#785EF0"];

			el.addEventListener("node-clicked", onNodeClicked);
			return () => el.removeEventListener("node-clicked", onNodeClicked);
		},
		[msa, submit, close]
	);

	// TODO: if taxonomic filter selected here, submit filtered sequences to outside component
	//  with submit() function prop
	return (
		<Modal
			opened={opened}
			onClose={close}
			withCloseButton={true}
			overlayProps={{
				blur: 3,
			}}
			size="70%"
		>
			<Stack>
				<div>TaxoView for {msa.length} sequences</div>
				<div>
					<strong>Selected taxon IDs:</strong> {selectedIds.length ? selectedIds.join(", ") : "-"}
				</div>
				<taxo-view ref={setTaxoEl} raw-data={taxonomyData} font-fill="white" />
				<Button
					onClick={() => {
						// TODO: this is just a dummy for actual taxonomic filtering based on selection in TaxoView component
						submit(selectedIds)
						close();
					}}
				>
					Apply taxonomic filter
				</Button>
			</Stack>
		</Modal>
	);
};
