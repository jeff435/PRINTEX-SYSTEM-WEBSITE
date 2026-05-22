import re
import json

raw_text = """
 SPARE PARTS IN STOCK. 23/2/2026
ROW	ITEM	QtTY	Ksh	USD	
	COLUMN A				
A	Control valves  M2.184.1111/05	24	12,400	$30	
	Control valves M2.184.1121/05	10	12,400	$30	
	Control valves M2.184.1131/05	3	16,250		
	Vibrator valves G2.184.0060	10	14,800	$35	
	Vibrator valves G2.184.0040	6	15,200	$34	
	Vibrator valve 61.184.1133	7	14,800	$35	
	Vibrator valve 61.184.1131	3	14,800	$35 	
	Vibrator valves L2.335.051	2	14,800	$35	
	Vibrator valves M2.184.1071/04	6	15,200	$35	
	Vibrator valve 61.1841181	2	14,800	35	
	Solenoid valve 61.184.1311	13	18,130	$28	
	Solenoid valve  98.184.1051	12
	18,620	$28	
	Pneumatic valve L2.334.002	2			
	Pneumatic cylinder 00.580.4275/01	1	32,250	$77	
	Pneumatic cylinder 87.334.010	4			
	Control valve M2.184.1131/05	3			
	Pneumatic cylinder 00.580.3909/02	6 
	18,250	$25	
	Pneumatic air cylinder 00.580.3930	2			
	Pneumatic cylinder F4.334.044		18,250	$25	
	Pneumatic cylinder 87.334.007/01	4	18,250	$25	
	Piston L2.007.531	1	65,000	210	
	Control valve 61.184.1191/01	1			
	CD102 CylinderF4.334.036/03	1	14,500	$26	
	COLUMN B				
B	Bellows for SM52	15	3,000	$4.2	
	Bellows for SM 74	21	4,250	$4.6	
	Bellows for CD74	11	4,950	$4.6	
	Bellows for CD102/XL105
	7	6,050	$4.8	
	Bellows for PM 74		3,795	$2.8	
	Sm52 autoplate	19			
	Sm/CD 102 Diaphram Autoplate	10			
	Diaphram clips	7	13,500	$20	
	Friction wheels F4.614.5565	24	6,150	$22	
	Grub screws L2.030.421	22	1,750	$1.2	T
	Locking screws	11	2,950	$3.5	
	adjusting spindle L2.030.412F	4	9,075	$11	
	Torsional springs	10	4,000	$4.8	
	Technotrans DS.196.2015	9	12,750	$11	
	Adjusting 
M2.030.012	4			
	COLUMN C				
C	Gear worm M2.006.001	16	5,500	$8.5	
	Worm gear 42.006.029	4	5,800	$8.5	
	Block cups 6mm muller martin	200	120	$0.1
	
	Feeder suckers 42.016.072
	175	100	$0.1	
	Cup suckers 20*6*13 white
	72	350                                    
	$0.1	
	Cup suckers black	100	350	$1
	
	feed suckers 42.016.073 black	200	100	$10	
	Bearing for CD74	7	9,310	$38	
	Gears for CD74	8	30,450	$87	
	Rubber sucker 43*13*1.0	50	100	$0.3	
	Rubber sucker 35*13*0.8	500	100	$0.2	
	Rubber sucker 35×13×1.0	385	100	$0.3	
	Rubber sucker 38×13×0.8	75	100	$0.2	
	Rubber sucker 38×13×1.3	100	100	$0.3	
	Rubber sucker 66.028.405				
	COLUMN D				
D	Cam follower SM74 00.550.1471/F-217813.04	15	11,250	$24	
	Cam follower SM102 F-53125.02	5		$55	
	Cam follower SM102 perfector F-229818.01	4	39,500	$113	
	Cam follower SM 52 00.550.1505 F-222190.01	12	6,000	$6	
	Cam follower CD74/CD102 F-229817	19	14,750	$30	
	Cam follower CD74 perfector F-229025	1			
	Cam follower F-53272 00.550.0462	1			
	Cam follower XL105  F2.072.009 F-57439.02		2		$58.5	
	Cam follower 00.550.0943 F-94474.01	2	11,500	$20	
	One way bearing 				
	Cam follower Perfecting F-208089.02	2	18,500	$26	
	Cam follower SM102 F-87592.03	5	17,750	$38	

	Cam follower SM74 delivery 00.550.0478 
F-54293.1	4
	11,250	$24	
	Cam follower F-51386.1	
		2			
	Cam follower F-54293.1	3			
	Bearing F-233282	2		$32	
	Cam follower F-237858.01	1	
		
	One way bearing  HFL3030L564	1			
	COLUMN E				
E	Blanket hooks	10	3,150	$2	
	Blanket hooks GTO	29	3,150	$2	
	Blanket hooks SM 74/SM102	49	3,150	$2	
	Gripper tips	91	1,750	$2.5	
	Feed gripper MO/SOR/ 27.013.049F		1,650	$2	
	Impression gripper 69.011.727	9	1,750	$2	
	Die cutter carriage gripper tip	40	1,650	$3	
	Delivery grippers GTO/SBB 14.875.001F	9	1,950	$2	
	Delivery gripper MO 43.014.004		1,650	$2	
	Impression gripper SBG S11227F-S	10	2,350	$3.5	
	Swing arm gripper MO	10	1,650	$2	
	Feed gripper Length 45mm	25	2,450	$2	
	Feeder gripper Length 50	30	2,450	$2	
	Feeder gripper GTO46/SBG/MO		26	2,450	$2	
	SM74/PM gripper left/right M2.014.011&004	35			
	Transfer cylinder C3.071.627	15			
	Gripper 		15
	1,650	$2	
					
	Gripper storage drum for SM74 M2.581.727/06	20			
	Gripper MO/GTO52/SM74		2,950
	$3	
	Twin separators paper M3.028.824S		3,500	$0.9	
	Single separator cardboard 66.028.810F		2,250	$0.7	
	Twin separator cardboard		3,500	$0.9	
	Single separator paper G2.028.1305		2,250	$0.7	
		
			
G	Buttons		8,415	$11	
	Push buttons 00.780.2321		1,250		
	CD 102 ink fountain dividers		9,750	$7.5	
	SM 74 ink fountain dividers		5,750	$8	
	SM 52 ink dividers		5,750	$8	
	Sunctions plates CD74/SM102/SM74		800	$0.5	
	Sunction head springs CD74/SM102/74		800	$0.5	
	Pneumatic cylinder 00.580.427				
					
	Stahl folder toothed belt FH.110.7871		22,500	$120
	
	Flange damper /curve bearing				
					
	Limit switches big		7,500	$8	
	Limit switches small		7,500	&8	
	Sensor F2.161.1411/02		10,200	$12	
	Damper water sensor M2.198.1563		10,200	$12	
					
	Front lay sensor 61.110.1461			$135	
	Ink zone motor 61.186.5411/03		11,500	$11	
	Wash up tank filters 00.580.4888		6,630	$7.8	
	D8251A		4,500	$6.5	
					
F	Compression springs		8,500	$	
	Pin F2.022.411		7,140	$6	
	Pin F2.022.413		7,395	$14	
	Connecting rod		33,150	$25	
					
					
J	Feeder suntion belt CD 102 F4.020.292		83,460	$107	
	Feeder sunction belt CD74 L2.020.014		67,600	$65	
	Feeder sunction belt SM74 M3.020.014		54,080	$52	
	Autoplate diaphram SM102		9,450	$14	
	Servo drive motor L2.105.1311/01 3NM		145,600	$49	
					
	
	Grease gun 150ml		23,870	$44	
	Coating pump diaphram SM 102		7,350	$14	
	Guard springs 32cm 300N CD74		5,000	$5.6	
	Guard springs 28cm 120N SM74		4,800	$5	
	Guard springs 24cm 150N CD74/SM74		4,800	$5	
	Guard springs 24cm 100N SM74/CD74		4,800	$5	
	Pneumatic cylinder 00.580.4275/01		32,250	$77	
	SM52 pan roller drive gear CPL MV.022.730,G2.030.201		21,750	$40	
	Carbon vanes		9,000	$11	
	Carbon sheets 130*52*5mm		3,750	$42	
	Oil filters		6,250	$4.6	
	Grease gun		23,870	$44	
	Mo Damper Journals 43.010.032
                                             43.030.001		13,650	$26	
	Solenoid valve stahl folder 227-878-01		57,750	$69	
	Perfector cam follower L2.583.320		48,000		
L	Break disc SM52		54,000		
	Break disc SM102 140*50*17		65,000	$79	
	Break disc 160*62*17mm		48,000	$	
	Adhesive form tapes		10,000		
	Wash up blades  SM52 G2.010.502		3,200	$2.6	
	Wash up blades GTO 69.010.180F		6,250	$6.5	
	Torsional springs MV.038.322		42,500	$40	
	Super blue nets		9,300	$4.4	
	Knocking board polar		8,370	$12	
	Transfer jackets SM52 G2.215.105N		22,500	$33	
	Transfer jackets SM74 M2.215.1055 (15holes)15MM		37,500	$62	
	Impression jackets SM52 G
1.011.273S		22,275	$33	
	Impression jackets SM 74 M2.581.173
No holes		33,750	$62	
	Delivery gripper bar  SM/PM 52		135,000	$230	
  	Feeder sunction belt SM52		12,600	$17	
	Latch L2.030.487		2,870	$45	
	Chain stressor SM74		10,710	$17	
	Doctor blades chamber seals flexo		1,750	$1.4	
	Xl105 toothed belt 00.580.5587		6,300	$9	
	CD74 toothed belt 25*2800 00.580.5962		11,760	$24	
	Xl105 toothed belt S8M*2048 00.580.6009		16,170	$42	
	Solenoid valve 61.184.1191		45,000	$60	
	MBO rubber suckers 23*3*1mm		200	$0.1	
	Mbo rubber sucker 23*3*0.5mm		200	$0.1	
	Feeder sunction belt SM74		25,200	$40	
	Heildelberg protective film 25m		4,650	$9.40	
	Filter sponge 250*470 (5pcs/bags)		2,800	$2.30
	
	Filter sponge 250*300 (5pcs/bag)		2,720	$28	
	Insulating tape (10pcs/bag)		750	$1.40	
	Sponge strip 10m 		2,300	$1.40	
	CD/SM102 protective film(12pcs/box)		7,400	$12	
	CD/SM 74 protective film (12pcs/box)		6,100	$10.50	
	CD/SM 102 ink duct film (100pcs/box)		9,750	$95	
	CD74 ink duct films (100pcs/box)		8,100	$16.20	
	SM 74 Barred 772mm*627mm*1.95mm		5,820	$21	
	CD74 Barred 772mm8700mm*1.95mm		7,250	$23	
	SM/CD 102 BARRED 1052mm*840mm*1.95mm		12,780	$34.50	
	SM/XL105 Barred 1077mm*885mm*1.95mm		13,405	$37.50	
	Creasing matrix 0.5*1.5 (50pcs/boxes)		4,800	$10	
	Creasing matrix 0.6*1.5 (50pcs/boxes)		4,800	$10	
	Creasing matrix 0.6*2.0 (50pcs/boxes		4,800	$10

	
	Threaded bolt		3,510	$4	
	Button		8,875	$19.50	
	Control knob 00.580.3999		3,120	$4	
	Solenoid valve 98.184.1051		18,620	$28	
	Solenoid valve 61.184.1311		18,130	$28	
	Heidelberg xl105 motherboard original		783,702	$707	
	Heidelberg SM52 brake pad 112*45*13		31,200	$60	
	Cutting sticks polar 92 45*10*930		160	$0.20	
	Cutting sticks polar 115 45*10*1160		175	$0.25	
	Cutting sticks polar 137 45*10*1380		200	$0.25	
	Wash up blade sm102  1090*57*0.5		16,700	$2.3	
	Hickey remover cylinder repair parts 28*36*5/7		1,850	$2.50	
K	Cylinder F4.334/02		18,250	$25	
	Moeller roller lever		4,500	$7.5	
	Lifting sucker spring		350	$0.50	
	SM 52 Lifting sucker spring		350	$0.50	
	Stahl folder drive roller		3,750	$6	
	MO/SM/SORM plate clamp		2,750	$2.5	
	MO/SM72/SORM plate clamp shim cut out 		2,700	$2.5	
	SM 74 distributor torsion spring		3,780	$3.5	
	MO/SM74 plate clamp roller adjuster rachet pin		850	$0.8	
	Roller adjuster o ring inner diameter 10mm
Outer diameter 12mm		10	$1	
	SM102/72/74/MO/S feed sucker retainer		1,200	$1.5	
	Spring plate left and right		1,485	$2	
	GTO/MO slow down ring 		550	$0.8	
	Weko T6/T77 spray nuit dive band powder		3,500	$6
	
	Filter bag technotrans/envetron		2,000	$2	
	MO/SM72 plate spanner 10mm		6,000	$6	
	Stainless stell roller setting gauge		6,000	$0.6	
	Small paper wedge (pair)		950	$0.9	
	00.580.6441 wanxiang hair dryer		9,450	$12	
	Lifting sucker nozzle F2.028.280s		3,500	$3.5	
	Printing sheet		1,000	$3,500	
	Printing sheet		1,250	$1.2	
	PS version clip punching pliers		7,500	$10	
	M2.184.1011 seals for piston impression pneumatic		12,825	$19	
	Guide pin sucker core  length 72mm		8,750	$13	
	Seal ring F4.335.001 offset machine gasket for C2.184.1051 cylinder		3,750	$4	
	F6.582.263 rubber sucker 		10	$6	
	00.580.3909 pneumatic cylinder		18,250	$25	
	Offset valve seal M2.184.1111,M2.184.1121.M2.184.1131 SEALS REPAIR PRINTING MACHINE		900	$0.90	
	Repair kit for M2.184.1111,M2.184.1121,M2.184.1131		900	$0.9	
	GTO  printing machine part sheet separator paper divider 		800	$0.8	
	GTO 52 printing machine part sheet separator paper divider separator		850	$0.9	
	G2.028.010F MV.030.574		11,250	$20	
	Sponge 		1,250	$2	
	89A32 Feeler gauge portal durable  stainless steel		3,750	$6	
	Heidelberge  SM52 threADED SPINDLE mv.032.838		7,500	$10	
	Srocket wheel gear for SM /CD102 36.014.103		5,000	$5	
	CPL shaft MV.034.249  		12,150	$12	
	Nozzles 81.205.132 SM/CD 102 Offset parts		2,000	$2.2	
	Delivery ultrasonic sensor 61.110.1494,61.110.1492		140,250	$297	
	Dampening guard strut pneumatic spring 917DO ,Stroke length 80mm
Force 100N
Extended length 235.5mm 00.580.4908		4,750	$10	
	Coating unit gas  pneumatic spring 083321
Stroke length 80mm,force 300N
Extended length 245m 00.580.5014		4,750	$10	
	Intermediate guard gas stut pneumatic spring2619NB
Stroke length 60mm
Extended length 205mm
Force 190N 00.580.6934		4,750	$10	
	Printing machine XL75/CD102,XL105
Pneumatic spring 6528TF
Extended length 175mm
Force 350N 00.580.6367		4,750	$10	


	Printing hydraulic rod Extended length 265,force 500N 00.580.6255		4,750	$10	
	Auto plate clamp for heidelberg SM/PM52		32,250	$58	
	Impression gripper 85mm*19mm gripper		2,250	$3	
	Spring rod for heidelberg SM74 M2.011.123		9,450	$14	
	Muller martini chain transport  left/right		1,350	$2.8	
	Martini		375	$0.8	
	V-ribbed belt 13pl20270 cd74 00.270.0139		32,000	$56	
	Timing belt total 13TS-1150		6,575	$15	
	Hickey remover 40*30*5mm		1,850	$3.5	
	SM 74 m2.117.1311 5W		2,850	$3.5	
	Anti marking blue 28inches*787*546mm		60,150	$162	
	Velero hook &loop tape male and female self adhesive		1,000	$22	
	M2.030.510 water roller gear sm/pm 74 		17,950	$38	
	L2.030.409 gear shaft CD74/XL75		21,250	$43	
	Muller martini stitcher head DB75		572,000	$2,358	
					
					
	Muller martini Db75 stitching heads 881.0037.4knife holder		56,700	$42	
	Muller martini		17,550	$6.5	
	Motor F2.105.1231		162,000	$343	
	L2.007.531  piston L2.007.533 housing XL75 		65,000	$210	
	Rotary valve seal PM52 XL75 L2.007.531		5,750	$5.5	
	M3.028.242 lifting sucker nozzle for cd74 		6,850	$9	
	O-ring seal 11mm*6mm*2.5mm			$1.8	
	Underlay packing sheets 1060*850*0.35		6,900	$15	
	New pure dampening roller cover widht 7cm			$30	
	Pullgauge thick spring CD102			$0.5	
	XL105 forwading sucker cpl F2.028.182S		8,750	$10	
	XL105 sucker cpl F2.028.162S		9,500	$13	
	Thimble filter for cylinder air 00.250.0086		2,470	$1.5	
	Brush for saddle stitching 889.0726.4		3,350	$4.5	
	MV.056.999 Lifting sucker nozzle CD74/XL75			$9	
	Timing belt 274teeth L-1370mm,W-12mm		6,800	$15	
	Gripper 		2,950	$2.5	
	Pin G2.030.023 		4,200	$5	
	F2.110.1331/05		34,425	$85	
	Cable F2.145.0122/03		22,680	$56	
	V-ribbed belt 19PL2197		36,750	$74	
	M2.011.123 Spring rod SM74		9,450	$14	
	 Hinge bolt 01.013.010		4,450	$4.5	
	Pull rail C5.072.605		8,750	$13	
	Profile rubber seal  C4.021.026F		3,250	$5	
	Profile rubber seal clip 		2,350	$1.8	
	Pure cotton dampening roller (roll)		21,250	$30	
	Ink key motor 61.186.5311		11,500	$12	
	Polar shear bolt 70mm*16mm		2,750	$3	
	MO/GTO/SM74 gripper		2,950	$3	

	Cylinder F4.334.044/02		18,250	$25	
	SM52 G2.030.201/MV.022.730			$40	
	Feeder brush wheel 66.020.122			$1	
	Printing press potential CD102  71.186.5172			$18	
	Base cover M2.014.053F size 1030*760mm			$32	
	Heildelberg sm74 intermediate roller size 46*752*900mm			$388	
	SM102 SENSOR 93.110.1321		35,640	$90	
	Kord delivery gripper bar		65,750	52	
	03.014.007 Gripper bar offfset KORD64 		12,500	$6	
	Delivery sheet stop G2.015.451			$6	
	L2.030.011,M2.030.011F Adjusting 			$10	
	00.780.2316 Emergency stop button  sm52,sm102/sm74 			$15	
	Blade 48*30*0.5mm 		2,640	$2	
	Guide pin sucker core  Lngth 72mm		7,750	$13	
	Solenoid valve		48,510	$105	
	Plate clamp lever 204-306 BG01		6,750	$10	
	Filter compressor sm74  150mm		2,350	$6.5	
	Filter  compressot sm74 80mm		1,950	$5.5	
	Heidelberg sm102/sm74 lifting sucker nozzle		1,950	$2	
	Heildelberg MO  alcolor damper roller flange			$10	
	Heidelberg MO shaft			$38	
	61.184.1133/01 MOZ ink duct vibrator valve			$38	
	Sensor WL9-P132			$15	
	Heidelberg Mo cylinder jacket 660*549*0.3mm			$24	
	Perfecting transfer mo griper 68*14m 52581.027			$35	
	Hohner stitch head 52/8 			$1	
	61*64*27mm 43.008.005F  running clutch			$52	
	Sheet counter 00.780.2290 24V			$36	
	Bearing 26*18*47.5mm 00.550.1070			$30	
	00.550.0943 cam follower F-94474 22*10*33			$20	
"""

def clean_price(val):
    if not val:
        return 0
    val = val.strip().replace("$", "").replace("Ksh", "").replace("KES", "").replace(",", "").replace("&", "")
    try:
        return float(val)
    except ValueError:
        return 0

def extract_sku(desc):
    patterns = [
        r'[A-Z0-9]{2}\.[0-9]{3}\.[0-9]{3,4}(?:/[0-9]{2})?[A-Z]?',
        r'[A-Z0-9][0-9]\.[0-9]{3}\.[0-9]{3,4}(?:/[0-9]{2})?[A-Z]?',
        r'[0-9]{2}\.[0-9]{3}\.[0-9]{3,4}(?:/[0-9]{2})?[A-Z]?',
        r'[A-Z]{2}\.[0-9]{3}\.[0-9]{3,4}[A-Z]?',
        r'[0-9]{3}\.[0-9]{4}\.[0-9]{1,4}[A-Z]?',
        r'[0-9]{5}\.[0-9]{3}',
        r'[0-9]{2}\.[0-9]{7}',
        r'[A-Z][0-9]\.[0-9]{3}/[0-9]{2}',
        r'F-[0-9]{5,6}(?:\.[0-9]{1,2})?',
        r'F[0-9]{1}\.[0-9]{3}\.[0-9]{3}(?:\.[0-9]{1,2})?',
        r'HFL[0-9A-Z]+',
        r'[0-9]{3}-[0-9]{3}-[0-9]{2}',
        r'[A-Z]{2}\.[0-9]{3}\.[0-9]{3}[A-Z]?',
        r'[A-Z][0-9]\.[0-9]{3}\.[0-9]{3}[A-Z]?',
        r'[0-9]{2}\.[0-9]{3}\.[0-9]{4}',
        r'WL9-P[0-9]{3}',
        r'D8251A',
        r'89A32',
    ]
    for p in patterns:
        m = re.findall(p, desc)
        if m:
            sku = m[0]
            cleaned_desc = desc.replace(sku, "", 1).strip()
            cleaned_desc = re.sub(r'\s+-\s+', ' ', cleaned_desc)
            cleaned_desc = re.sub(r'\s+', ' ', cleaned_desc)
            cleaned_desc = cleaned_desc.strip(" -/,")
            return sku, cleaned_desc
    return "", desc

text = raw_text.replace("\r\n", "\n")

replacements = [
    ("\tSolenoid valve  98.184.1051\t12\n\t18,620\t$28\t", "\tSolenoid valve  98.184.1051\t12\t18,620\t$28"),
    ("\tPneumatic cylinder 00.580.3909/02\t6 \n\t18,250\t$25\t", "\tPneumatic cylinder 00.580.3909/02\t6\t18,250\t$25"),
    ("\tBellows for CD102/XL105\n\t7\t6,050\t$4.8\t", "\tBellows for CD102/XL105\t7\t6,050\t$4.8"),
    ("\tAdjusting \nM2.030.012\t4\t\t\t", "\tAdjusting M2.030.012\t4\t\t\t"),
    ("\tFeeder suckers 42.016.072\n\t175\t100\t$0.1\t", "\tFeeder suckers 42.016.072\t175\t100\t$0.1"),
    ("\tCup suckers 20*6*13 white\n\t72\t350                                    \n\t$0.1\t", "\tCup suckers 20*6*13 white\t72\t350\t$0.1"),
    ("\tCam follower SM74 delivery 00.550.0478 \nF-54293.1\t4\n\t11,250\t$24\t", "\tCam follower SM74 delivery 00.550.0478 F-54293.1\t4\t11,250\t$24"),
    ("\tCam follower F-51386.1\t\n\t\t2\t\t\t", "\tCam follower F-51386.1\t2\t\t\t"),
    ("\tGripper \t\t15\n\t1,650\t$2\t", "\tGripper\t15\t1,650\t$2"),
    ("\tGripper MO/GTO52/SM74\t\t2,950\n\t$3\t", "\tGripper MO/GTO52/SM74\t\t2,950\t$3"),
    ("\tMo Damper Journals 43.010.032\n                                             43.030.001\t\t13,650\t$26\t", "\tMo Damper Journals 43.010.032 43.030.001\t\t13,650\t$26"),
    ("\tImpression jackets SM52 G\n1.011.273S\t\t22,275\t$33\t", "\tImpression jackets SM52 G 1.011.273S\t\t22,275\t$33"),
    ("\tImpression jackets SM 74 M2.581.173\nNo holes\t\t33,750\t$62\t", "\tImpression jackets SM 74 M2.581.173 No holes\t\t33,750\t$62"),
    ("\tRoller adjuster o ring inner diameter 10mm\nOuter diameter 12mm\t\t10\t$1\t", "\tRoller adjuster o ring inner diameter 10mm Outer diameter 12mm\t\t10\t$1"),
    ("\tDampening guard strut pneumatic spring 917DO ,Stroke length 80mm\nForce 100N\nExtended length 235.5mm 00.580.4908\t\t4,750\t$10\t", "\tDampening guard strut pneumatic spring 917DO ,Stroke length 80mm Force 100N Extended length 235.5mm 00.580.4908\t\t4,750\t$10"),
    ("\tCoating unit gas  pneumatic spring 083321\nStroke length 80mm,force 300N\nExtended length 245m 00.580.5014\t\t4,750\t$10\t", "\tCoating unit gas  pneumatic spring 083321 Stroke length 80mm,force 300N Extended length 245m 00.580.5014\t\t4,750\t$10"),
    ("\tIntermediate guard gas stut pneumatic spring2619NB\nStroke length 60mm\nExtended length 205mm\nForce 190N 00.580.6934\t\t4,750\t$10\t", "\tIntermediate guard gas stut pneumatic spring2619NB Stroke length 60mm Extended length 205mm Force 190N 00.580.6934\t\t4,750\t$10"),
    ("\tPrinting machine XL75/CD102,XL105\nPneumatic spring 6528TF\nExtended length 175mm\nForce 350N 00.580.6367\t\t4,750\t$10\t", "\tPrinting machine XL75/CD102,XL105 Pneumatic spring 6528TF Extended length 175mm Force 350N 00.580.6367\t\t4,750\t$10")
]

for old, new in replacements:
    text = text.replace(old, new)

lines = text.split("\n")
parts_db = []
start_id = 129
current_cat = "A"

for line in lines:
    line_str = line.strip()
    if not line_str:
        continue
    if line_str.startswith("COLUMN"):
        current_cat = line_str.split(" ")[-1].strip()
        continue
    if line_str in ["A", "B", "C", "D", "E", "G", "F", "J", "L", "K"]:
        current_cat = line_str
        continue
        
    row_parts = [p.strip() for p in line.split("\t")]
    non_empty = [p for p in row_parts if p]
    if not non_empty:
        continue
        
    first = non_empty[0]
    if first in ["A", "B", "C", "D", "E", "G", "F", "J", "L", "K"]:
        current_cat = first
        non_empty = non_empty[1:]
        if not non_empty:
            continue
            
    desc_raw = non_empty[0]
    sku, desc_cleaned = extract_sku(desc_raw)
    
    rem = non_empty[1:]
    qty = 0
    ksh = 0.0
    usd = 0.0
    
    price_vals = []
    qty_val = None
    
    for r in rem:
        if "$" in r:
            usd = clean_price(r)
        elif r.isdigit() and int(r) < 1000 and qty_val is None:
            qty_val = int(r)
        else:
            val = clean_price(r)
            if val > 1000:
                ksh = val
            elif val > 0:
                price_vals.append(val)
                
    for pv in price_vals:
        if ksh == 0 and pv >= 100:
            ksh = pv
        elif usd == 0 and pv < 1000:
            usd = pv
        elif qty_val is None:
            qty_val = int(pv)

    if qty_val is None:
        qty_val = 0
        
    if ksh == 0:
        if usd > 0:
            ksh = usd * 130
        else:
            ksh = 0
            
    desc_cleaned = re.sub(r'\s+', ' ', desc_cleaned).strip()
    
    supplier = "Other"
    loc_desc = desc_cleaned.lower()
    if "heidelberg" in loc_desc or "heildelberg" in loc_desc:
        supplier = "Heidelberg"
    elif "muller" in loc_desc or "martini" in loc_desc or "hohner" in loc_desc:
        supplier = "Muller Martini"
    elif "polar" in loc_desc:
        supplier = "Polar"
    elif "stahl" in loc_desc:
        supplier = "Stahl"
    elif "festo" in loc_desc:
        supplier = "Festo"
    elif "smc" in loc_desc:
        supplier = "SMC"
    elif "technotrans" in loc_desc:
        supplier = "Technotrans"
    elif "weko" in loc_desc:
        supplier = "Weko"
        
    loc_map = {
        'A': 'Warehouse A1',
        'B': 'Warehouse B1',
        'C': 'Warehouse C1',
        'D': 'Warehouse D1',
        'E': 'Warehouse E1',
        'F': 'Warehouse F1',
        'G': 'Warehouse G1',
        'J': 'Warehouse J1',
        'K': 'Warehouse K1',
        'L': 'Warehouse L1',
    }
    location = loc_map.get(current_cat, "Warehouse G1")
    
    min_stock = 1
    if qty_val > 10:
        min_stock = 5
    elif qty_val > 5:
        min_stock = 2
        
    if not desc_cleaned or desc_cleaned.isdigit():
        desc_cleaned = f"Spare Part {sku if sku else start_id}"
        
    parts_db.append({
        "id": start_id,
        "category": current_cat,
        "partNum": sku if sku else f"SKU-{start_id}",
        "desc": desc_cleaned,
        "stock": qty_val,
        "minStock": min_stock,
        "priceKsh": int(ksh),
        "supplier": supplier,
        "location": location
    })
    start_id += 1

js_code = """
window.printexBulkImportData = """ + json.dumps(parts_db) + """;

window.runPrintexBulkImport = async function() {
  if (window._printexImportRunning) return;
  window._printexImportRunning = true;
  
  const toImport = window.printexBulkImportData;
  console.log('Starting bulk import of ' + toImport.length + ' parts...');
  window.showToast('Starting bulk import of ' + toImport.length + ' parts...', 'info');
  
  let added = 0;
  let updated = 0;
  
  for (const part of toImport) {
    const existingIdx = window.parts.findIndex(p => 
      p.partNum === part.partNum || 
      (p.part_num && p.part_num === part.partNum) ||
      (p.desc === part.desc && p.category === part.category)
    );
    
    if (existingIdx !== -1) {
      // Update existing
      const existing = window.parts[existingIdx];
      existing.stock = part.stock; // Update quantity
      existing.priceKsh = part.priceKsh; // Update price
      existing.supplier = part.supplier;
      existing.location = part.location;
      existing.desc = part.desc;
      existing.category = part.category;
      
      try {
        await window.dbPut('parts', existing);
        updated++;
      } catch (e) {
        console.error('Failed to update part', part, e);
      }
    } else {
      // Add new
      const newPart = { ...part, id: 'prt_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now() };
      try {
        await window.dbPut('parts', newPart);
        window.parts.push(newPart);
        added++;
      } catch (e) {
        console.error('Failed to add part', part, e);
      }
    }
  }
  
  window.showToast(`Import complete! Added ${added}, Updated ${updated} parts.`, 'success');
  console.log(`Import complete! Added ${added}, Updated ${updated} parts.`);
  
  if (typeof window.filterInventory === 'function') window.filterInventory();
  if (typeof window.renderDashboard === 'function') window.renderDashboard();
  
  window._printexImportRunning = false;
};
"""

with open("c:/Users/ADMIN/OneDrive/Desktop/PRINTEX/PRINTEX-SYSTEM-WEBSITE/src/modules/bulk_import.js", "w", encoding="utf-8") as f:
    f.write(js_code)

print("Generated bulk_import.js")
