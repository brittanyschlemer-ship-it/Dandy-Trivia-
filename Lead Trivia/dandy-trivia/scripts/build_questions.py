#!/usr/bin/env python3
"""Generates data/questions.json. Edit the lists below (or edit the JSON directly) to maintain the bank.
Run from the project root:  python3 scripts/build_questions.py
"""
import json, collections

G  = "Dandy Glossary & Acronyms (uploaded PDF)"
GT = "Dandy Glossary & Acronyms (uploaded PDF) - Common Terms"
SITE_LABS = "meetdandy.com/labs (public site; read via web search, direct fetch was blocked)"
SITE_HOME = "meetdandy.com home page (public site; read via web search)"
SITE_CAREERS = "meetdandy.com/careers (public site; read via web search)"
PR_ENG = "Dandy press release, Apr 22 2025 (meetdandy.com/newsroom)"
PR_LDR = "Dandy press release, May 22 2025 (meetdandy.com/newsroom)"
PR_STUDY = "Dandy Dental Study press release, PRNewswire, Jul 17 2023"
PR_FUSION = "Dandy press release, Sep 29 2026 (GlobeNewswire headline)"
PR_YU = "Dandy press release, Jul 28 2026 (GlobeNewswire headline)"
LI = "Dandy LinkedIn company page"

Q = []
def q(cat, diff, text, correct, wrong, expl, src):
    assert len(wrong) == 3 and correct not in wrong and len(set(wrong)) == 3, text
    Q.append(dict(category=cat, difficulty=diff, question=text, correct=correct, wrong=wrong, explanation=expl, source=src))

A="Dandy Acronyms"; T="Teams & Workflows"; D="Dental Terms"; B="Business Lingo"; C="Company Facts"; P="Products & Digital Dentistry"; F="Culture & Fun"

# ---------- Culture & Fun ----------
q(F,"easy","What does the Dandy glossary affectionately call new employees?","Dandians",["Dandies","Dentists","Dandelions"],"The glossary's intro hopes to reduce head-scratching for new \"Dandians\".",G)
q(F,"easy","The glossary says its list of acronyms is just the tip of the what?","Iceberg",["Molar","Toothbrush","Crown"],"\"See below for just the tip of the iceberg.\"",G)
q(F,"medium","YADDI is an acronym the glossary hopes to make obsolete. What does it stand for?","Yet Another Due Date Issue",["Yet Another Design Defect Incident","Your Account Details Data Import","Yet Another Denture Delivery Inquiry"],"The glossary adds: \"let's kill the need for this acronym.\"",G)
q(F,"hard","DBCFPA is the name of a Dandy award. What does it stand for?","Dandy Best Cross Functional Partner Award",["Dandy Business Case Forecast Planning Approach","Digital Brand Content for Practice Acquisition","Dandy Best Customer Feedback Praise Award"],"It honors the best cross-functional partner.",G)
q(F,"medium","IT warned Dandians in Slack about an uptick in attempted phishing via what unusual channel?","Calendar invites",["QR codes on lab packages","Fax machines","Voicemail transcripts"],"IT recommended treating calendar invites with the same suspicion as phishing emails.","Slack #always-be-learning (Sep 2026)")
q(F,"medium","A recent #shipped post said Dandy was getting closer to the 'north star' of working out of which system only?","NetSuite",["Salesforce","Zendesk","Highspot"],"The post celebrated progress toward working out of NetSuite only.","Slack #shipped (Oct 2026)")

# ---------- Company Facts / Products (public) ----------
q(C,"easy","What does Dandy provide free to practices as part of its digital lab offering?","An intraoral scanner",["A 3D printer","A milling machine","A panoramic X-ray unit"],"Dandy advertises the 'world's smartest intraoral scanner' for free (site terms apply).",SITE_HOME)
q(C,"easy","How does Dandy handle physical impression molds?","It doesn't accept them; it is 100% digital",["It accepts them for dentures only","It accepts them by mail with a surcharge","It accepts them only from new practices"],"Dandy states it does not accept physical impressions.",SITE_LABS)
q(C,"medium","In which two states are Dandy's US manufacturing facilities located?","Utah and Texas",["New York and New Jersey","California and Arizona","Florida and Georgia"],"The site lists labs in Lehi, UT and Carrollton, TX.",SITE_LABS)
q(C,"easy","Dandy's Texas manufacturing facility is in a suburb of which city?","Dallas",["Houston","Austin","San Antonio"],"Carrollton, TX is a Dallas suburb.",SITE_LABS)
q(C,"medium","Dandy's denture workflow is advertised as requiring how many appointments?","Two",["One","Three","Four"],"Dandy promotes its 2-appointment denture workflow.",SITE_LABS)
q(C,"easy","Dandy describes itself as building the modern operating system for what?","Dentistry",["Orthodontics","Dental insurance","Dental education"],"Dandy's boilerplate: 'building the modern operating system for dentistry'.",PR_ENG)
q(C,"medium","In April 2025 Dandy announced Cong Yu as its new what?","Head of Engineering",["CEO","Head of People","Head of Customer Experience"],"Dandy named Cong Yu Head of Engineering to lead AI-powered design and manufacturing.",PR_ENG)
q(C,"hard","Before joining Dandy, Cong Yu most recently served as VP of Engineering at which company?","Celonis",["Amazon","Uber","Waymo"],"The release says he most recently led AI at Celonis; earlier he was at Google Research.",PR_ENG)
q(C,"medium","In that April 2025 release, who was quoted as Dandy's CEO?","Daniel Hanover",["Cong Yu","Lisa Duron","Joe Lynch"],"Daniel Hanover is quoted as CEO.",PR_ENG)
q(C,"medium","Dandy said it surpassed what revenue milestone in its first two years?","$100 million",["$10 million","$500 million","$1 billion"],"The release says Dandy passed $100 million in revenue in its first two years.",PR_ENG)
q(C,"hard","Dandy planned to hire how many engineers in 2025, many in remote roles?","More than 50",["About 10","About 200","More than 500"],"The release says it planned to hire more than 50 engineers in 2025.",PR_ENG)
q(C,"medium","According to Dandy's careers page, how many people already have a Dandy product in their mouth?","Over 2 million",["Over 200,000","Over 20 million","Over 200 million"],"The careers page says over 2 million people already have a Dandy product.",SITE_CAREERS)
q(F,"medium","Dandy's careers page says its culture is built around what?","Flexibility and trust",["Mandatory office days","Rotating on-call shifts","Annual relocation"],"The page highlights flexibility, with tools and trust to do your best work.",SITE_CAREERS)
q(C,"medium","Dandy's 2023 'Dental Study: Patient Experience' surveyed how many US adults?","600",["60","6,000","60,000"],"Isurus Market Research surveyed 600 Americans aged 26+.",PR_STUDY)
q(C,"hard","In that study, what percent of people looking for a new dentist use online reviews?","67%",["25%","50%","90%"],"67% use online reviews; Google was most popular (81%).",PR_STUDY)
q(C,"medium","How many CE credits did Dandy's free virtual 'Digital Summit' offer?","2",["1","4","6"],"The summit promised 2 CE credits.",LI)
q(C,"hard","Dandy celebrated being named a Built In 'Best Place to Work' in a post using which year's hashtag?","2024",["2021","2022","2026"],"The post used #2024BuiltInBest.",LI)
q(P,"medium","Which denture line did Dandy announce launching on September 29, 2026?","Fusion",["Chairside","Vision","Dante"],"Dandy launched the Fusion denture line.",PR_FUSION)
q(C,"hard","In July 2026 Dandy announced a partnership with which university's new College of Dental Medicine?","Yeshiva University",["NYU","Columbia University","University of Pennsylvania"],"Partnership to power digital dentistry education.",PR_YU)
q(P,"easy","What does Dandy's Live Design Review let dentists do?","Refine a design with a lab tech on a shared 3D model before production",["Print crowns in the office","Order supplies by voice","Schedule patient appointments"],"It enables real-time collaboration on a shared CAD model before production.",PR_LDR)
q(P,"medium","Dandy's May 2025 launch added real-time features to which software?","Chairside and case management software",["Payroll software","Aligner treatment-planning only","Dental insurance billing"],"The suite extended Dandy's Chairside and case-management tools.",PR_LDR)
q(P,"medium","Dandy says a lab tech can join the operatory in about how long?","60 seconds",["5 minutes","15 minutes","24 hours"],"'In 60 seconds, a lab-tech joins your op.'",SITE_LABS)
q(P,"medium","Dandy's Digital Implant Readiness workflow helps practices order what in advance?","Scan bodies",["Surgical guides","Healing caps","Bite registrations"],"It helps order scan bodies beforehand (see also SB).",SITE_LABS)
q(P,"medium","Dandy's mandibular advancement devices are positioned as an alternative to what?","CPAP",["Night guards","Retainers","Fluoride trays"],"They are offered as a CPAP alternative for obstructive sleep apnea.",SITE_LABS)
q(P,"easy","Which of these product categories does Dandy offer?","Clear aligners",["Hearing aids","Orthopedic implants","X-ray machines"],"Dandy lists clear aligners among its services.",SITE_LABS)
q(P,"easy","What is Dandy's Chairside software designed to do?","Guide practices step by step through scanning",["Mill crowns on the lab floor","Track payroll","Edit X-rays"],"The site describes Chairside as guiding you through each scanning step.",SITE_LABS)
q(P,"medium","What is the name of Dandy's branded intraoral scanner?","Dandy Vision",["Dandy Lens","Dandy Scope","Dandy Snap"],"Slack discussions refer to Vision scanners.","Slack #proj-vision-chairside-epd; Institute of Digital Dentistry review (Mar 2026)")
q(P,"hard","A May 2026 Slack analysis compared Vision and Trios scans at the prep site. How does Vision's mesh compare?","Higher density (shorter average edge length)",["Identical density","Lower density","Cannot be measured"],"Average edge length was about 0.07mm for Vision vs 0.1mm for Trios.","Slack #proj-vision-chairside-epd (May 2026)")

# ---------- Acronyms: company & org ----------
q(A,"easy","What does DDC stand for at Dandy?","Dandy Design Center",["Digital Dental Cloud","Dandy Delivery Center","Direct Dentist Care"],"DDC is where designers create restorations.",G)
q(A,"medium","DDE is the internal CAD application designers use. What does it stand for?","Dandy Design Editor",["Digital Design Engine","Dandy Dental Estimator","Direct Design Environment"],"DDE is the internal CAD app used to design restoratives.",G+"; Slack #proj-vision-chairside-epd")
q(A,"hard","What does DANTE stand for?","Dandy Automated Natural prosThetics Engine",["Dandy Automated Neural Treatment Estimator","Digital Anatomy and Tooth Enhancement","Dandy Augmented Neural Tooth Engine"],"Note the capital T hiding in 'prosThetics'.",G)
q(A,"medium","What does Dandy's in-house ML model DANTE generate designs for?","Crowns",["Aligners","Dentures","Night guards"],"DANTE is trained by the CAD/ML team to generate crown designs.",G+"; Slack #ml-dante-development")
q(A,"easy","RBR is the company's north star for quality. What does it stand for?","Refab or Bad Review",["Revenue Before Returns","Refund and Billing Rate","Rush Batch Release"],"RBR is the share of orders ending in a refabrication or bad review.",G)
q(A,"medium","What does RBR measure?","The % of orders that resulted in a refab or bad review",["The % of orders shipped late","Average revenue per practice","The % of practices that are ramped"],"RBR is Dandy's quality north star.",G)
q(A,"easy","What does OTD stand for?","On-time Delivery",["Order To Dentist","Out of Date","Operations Throughput Dashboard"],"OTD = % of orders delivered on or before the original ETA.",G)
q(A,"medium","OTD is measured against which date?","The original ETA given to the customer at order",["The ship-by date","The designer's promised finish time","The average TAT for that product"],"On time means on or before the original ETA.",G)
q(A,"medium","What does OTS stand for?","On-time Shipping",["Order Tracking System","Outbound Tray Sorting","Overnight Ship Service"],"OTS measures orders shipped on or before the original ship-by date.",G)
q(A,"easy","What does TAT stand for?","Turnaround Time",["Total Appointment Time","Tooth Alignment Tracker","Time After Trial"],"Planned TATs exist for each major stage.",G)
q(A,"medium","Dandy sets planned TATs for which three major stages?","Design, fabrication, and shipping",["Scanning, billing, and support","Design, QA, and billing","Sales, onboarding, and training"],"Planned vs actual TAT helps explain OTD performance.",G)
q(A,"easy","What does DRI stand for?","Directly Responsible Individual",["Dentist Request Intake","Design Review Initiative","Digital Records Index"],"The person ultimately responsible for a decision or project.",G)
q(A,"medium","What does DICE stand for in Dandy's support world?","Designated Interruption Coverage Engineer",["Digital Implant Case Evaluator","Daily Incident Command Executive","Design Intake Control Experiment"],"DICE is a support (on-call) rotation.",G)
q(A,"medium","What does SLF stand for?","Small Lab Feel",["Single Location Facility","Scan Level Feedback","Standard Lab Format"],"SLF captures the feeling of a small, personal lab.",G)
q(A,"hard","What does FMR stand for?","Flag Monitor React",["Fabrication Mill Run","First Manufacturing Release","Final Margin Review"],"Listed in the glossary as Flag Monitor React.",G)
q(A,"hard","What does FTL stand for?","Failure to Launch",["Fast Turn Lab","Full Tooth Library","Forward Tracking Log"],"Listed in the glossary as Failure to Launch.",G)
q(A,"easy","What does LDR stand for?","Live Design Review",["Lab Delivery Report","Late Delivery Rate","Lower Denture Rim"],"A live session reviewing a design with the practice.",G)
q(A,"easy","What does LSR stand for?","Live Scan Review",["Lab Shipping Receipt","Lingual Surface Record","Large Scale Release"],"Live review of a scan while the patient is in the chair.",G)
q(A,"medium","What does VDR stand for?","Video Design Review",["Virtual Denture Registration","Verified Design Record","Vertical Dimension Reading"],"Part of the Visual Interactions workflow.",G)
q(A,"hard","The Visual Interactions (VI) team initially spanned which two workflows?","VDR and LDR",["LSR and DDP","DDE and DANTE","OTD and OTS"],"VI initially spanned Video Design Review and Live Design Review.",G)
q(A,"medium","What does CST stand for?","Clinical Support Team",["Customer Success Team","Case Scheduling Tool","Crown & Smile Technicians"],"CST supports practices on clinical questions.",G)
q(A,"hard","The Clinical Support Specialist (CSS) role was formerly known as what?","Tier 2",["Tier 1","Tier 3","Level A"],"CSS was formerly Tier 2.",G)
q(A,"hard","The Product Support Team (PST) was formerly known as what?","Tier 1",["Tier 2","Dentist Experience","Support Level 0"],"PST was formerly Tier 1.",G)
q(A,"hard","Practice Partnership & Retention (PPR) was formerly called what?","Dentist Experience",["Customer Intelligence","Partner Service","Account Management"],"PPR was formerly Dentist Experience.",G)
q(A,"medium","DX can stand for Developer Experience or what else?","Dentist Experience",["Design Extraction","Digital Express","Delivery Exchange"],"The glossary lists both meanings.",G)
q(A,"medium","DDP is also known as what?","Wax ups",["Kickbacks","Try-ins","Scan stitching"],"DDP = Digital Design Preview, AKA wax ups.",G)
q(A,"medium","What does DVD stand for at Dandy?","Dandy Verified Design",["Dental Veneer Delivery","Denture Variation Data","Digital Video Dentistry"],"Not the disc kind.",G)
q(A,"medium","What does UPD track for DDC designers?","Units Per Day (designs produced in a day)",["Updates Per Deployment","Unique Patients Daily","Uptime Per Device"],"UPD = Units Per Day.",G)
q(A,"hard","What does UTA stand for?","Unit Time Allotment",["Universal Tooth Alignment","Unit Throughput Average","Upper Tooth Arch"],"The standard time allocated to process a single unit on a task.",G)
q(A,"hard","What does GDS stand for?","Global Design Squad",["Group Dental Services","General Design Standard","Great Dandy Style"],"Listed in the glossary.",G)
q(A,"medium","What does AMP stand for?","Aligner Mentorship Program",["Advanced Milling Process","Automated Manufacturing Pipeline","Account Management Plan"],"Listed in the glossary.",G)
q(A,"medium","What does OBC stand for?","Onboarding Champion",["Order Batch Control","Office Billing Contact","Online Booking Calendar"],"See also: Setup Champion.",G)
q(A,"medium","What does STF stand for in partials?","Straight-to-finish",["Scan to Fabrication","Standard Turnaround Fee","Staged Tray Fit"],"Used to note that the try-in is skipped.",G)
q(A,"easy","What does RFD stand for?","Ready for Design",["Rush for Delivery","Review Finished Design","Remake for Dentist"],"A case status before design begins.",G)
q(A,"medium","What does RFF stand for?","Ready for Fabrication",["Refab for Free","Required Fit Form","Return for Fix"],"A case status before fabrication.",G)
q(A,"medium","What does IR stand for?","Internal Remake",["Inventory Report","Intraoral Review","Implant Restoration"],"Referenced alongside kickbacks.",GT)
q(A,"hard","What does PRR stand for?","Peer Refab Review",["Product Release Readiness","Practice Retention Rate","Prep Review Report"],"Listed in the glossary.",G)
q(A,"medium","What does CTS measure?","Cost to Serve",["Crown Turnaround Speed","Case Tracking Status","Clinical Training Score"],"Cost a company spends to service customers.",G)
q(A,"medium","What does C+R stand for?","Cancel and resubmit",["Check and Review","Crown plus Restoration","Credit and Refund"],"A workflow for customers and CX to self-service order changes.",G)
q(A,"hard","What does NTS stand for?","New Training Shipment",["Next Ticket Status","National Territory Sales","Night guard Tray Set"],"Listed in the glossary.",G)
q(A,"medium","What does EPD stand for?","Engineering, Product & Design",["Executive Planning Division","Equipment, Parts & Delivery","Education, People & Development"],"The team that builds Dandy's software.",G)
q(A,"hard","What does PFL stand for?","Planning, Fulfillment & Logistics",["Product Fit Level","Practice Finance Ledger","Plan, Fabricate, Launch"],"Listed in the glossary.",G)
q(A,"hard","What does JBS stand for?","Job Breakdown Sheet",["Joint Bite Study","Just Between Shifts","Job Booking System"],"Listed in the glossary.",G)
q(A,"medium","What does KOC stand for?","Kick Off Call",["Key Operations Center","Knowledge Of Crowns","Kit Order Confirmation"],"Listed in the glossary.",G)
q(A,"medium","What does TTFR stand for?","Time to First Response",["Total Tooth Fabrication Rate","Ticket Transfer Flow Rate","Training Time For Reps"],"Support responsiveness metric.",G)
q(A,"medium","What does TTR stand for?","Time to Resolution",["Time to Ramp","Tooth Treatment Review","Total Tray Return"],"Support resolution metric.",G)
q(A,"hard","TTI (Team Ticket Interactions) is usually measured how?","As a % of total interactions with customers",["In hours per ticket","In dollars per ticket","As a count per day"],"Per the glossary.",G)
q(A,"medium","What does OOS stand for?","Out of Stock",["Out of Spec","Order Operations Specialist","Operations Support Staff"],"Not to be confused with OOps (Order Ops).",G)
q(A,"hard","What does OOps stand for?","Order Ops",["Operations Out-of-Policy","Oral Operations","Overnight Operations"],"The Order Operations team.",G)
q(A,"hard","What does BPO stand for at Dandy?","Business Process Organization",["Best Practices Office","Batch Production Order","Build Plan Override"],"It covers offshoring management.",G)
q(A,"medium","What do SF and SFDC stand for?","Salesforce",["Scan Fabrication Dashboard","Sales Funnel Data Cube","Smile Forecast"],"Both abbreviate Salesforce.",G)
q(A,"easy","What does ELT stand for?","Executive Leadership Team",["Employee Learning Track","Early Launch Team","Engineering Lead Table"],"It can also mean Extended Leadership Team; see also SLT.",G)
q(A,"medium","What does SLP stand for?","Single location practices",["Standard lab process","Scan level planning","Service line partner"],"The counterpart to MLP (multi-location practices).",G)
q(A,"easy","What does DSO stand for?","Dental Support (or Service) Organization",["Digital Scanning Office","Dentist Staffing Option","Dental Supply Order"],"A group that supports multiple dental practices.",G)
q(A,"medium","What does AE stand for (not to be confused with Account Manager)?","Account Executive",["Aligner Engineer","Accounting Entry","Area Estimator"],"AE and AM are different roles.",G)
q(A,"medium","What does BDR stand for?","Business Development Representative",["Bite Design Review","Batch Delivery Report","Brand Digital Relations"],"A sales role.",G)
q(A,"hard","What does PSR stand for?","Partner Service Representative",["Product Support Rep","Practice Success Rate","Prep Scan Review"],"An internal Dandy user.",G)
q(A,"medium","What does STS stand for?","Sales and Training Specialist",["Scan to Surface","Standard Turnaround Schedule","Support Team Supervisor"],"Listed in the glossary.",G)
q(A,"hard","What does SA stand for?","Standard Adherence",["Scan Accuracy","Service Agreement","Support Analyst"],"Listed in the glossary.",G)
q(A,"medium","What does CXIT stand for?","Customer Experience IT",["Crown eXperience Integration Team","Clinical eXpert IT","Cloud Exchange Infrastructure Team"],"Listed in the glossary.",G)
q(A,"medium","What does NPI stand for at Dandy?","New Product Introduction",["Net Promoter Index","National Provider Identifier","New Patient Intake"],"Taking a product from idea through R&D to launch.",G)
q(A,"medium","What does OEE stand for?","Overall Equipment Effectiveness",["Order Execution Efficiency","Operational Expense Estimate","Output Error Evaluation"],"A manufacturing metric.",G)
q(A,"medium","UDI is required for customs on international orders. What does it stand for?","Unique device identification",["Universal Dental ID","Unified Delivery Index","Unit Dispatch Invoice"],"Configured with GS1 and Benchside product configuration.",G)
q(A,"hard","What does MEA stand for?","Middle East-Africa",["Manufacturing Equipment Audit","Monthly Executive Agenda","Marketing Engagement Analysis"],"A region.",G)
q(A,"medium","What does PiB stand for?","Planning in Browser",["Production in Batches","Portal in Beta","Print in Bulk"],"Listed in the glossary.",G)

# ---------- Teams & Workflows ----------
q(T,"easy","At Dandy, a 'ramped' practice has how many lifetime orders?","50+",["10+","25+","100+"],"The glossary defines ramped as 50+ lifetime orders.",GT)
q(T,"medium","What is a 'kickback' at Dandy?","An order item returned to a previous workflow step for correction",["A bonus paid to top designers","A practice referral reward","A shipment returned by the carrier"],"It means the item failed informal QC.",GT)
q(T,"medium","What does a 'Setup Champion' do?","Completes practice portal onboarding for a practice",["Designs complex bridges","Leads the manufacturing floor","Runs the weekly business review"],"Practice staff who complete portal onboarding.",GT)
q(T,"medium","P1 and A1 are design levels. What do they do?","Assign cases to qualified designers",["Rank practices by revenue","Schedule shipments","Label scanner firmware versions"],"As levels go up, unit counts and complexity rise.",G)
q(T,"medium","In design level 'A1', what does the 'A' stand for?","Anterior",["Aligner","Abutment","Adhesive"],"A1 = Anterior Level 1; P1 = Posterior Level 1.",G)
q(T,"medium","In scanning, what does 'scan stitching' mean?","Compositing hundreds of micro-scans into a full scan",["Sewing together fabric trays","Merging two practices' accounts","Printing a scan on a crown"],"In design it can also mean manually compositing multiple scans.",GT)
q(T,"medium","What is 'bite alignment'?","Aligning a bite scan to the prep and antagonist scans",["Adjusting a patient's jaw by hand","Matching crown shade to teeth","Aligning two practices' orders"],"Per the glossary's common terms.",GT)

# ---------- Business Lingo ----------
q(B,"easy","What does OKR stand for?","Objectives and Key Results",["Operations and Key Reports","Order Kickback Rate","Objectives for Knowledge Retention"],"A goal-setting framework.",G)
q(B,"medium","What does MECE stand for?","Mutually Exclusive, Collectively Exhaustive",["Measured Evenly, Completely Explained","Mostly Efficient, Clearly Executed","Managed, Evaluated, Controlled, Enhanced"],"A structured-thinking principle.",G)
q(B,"easy","What does WBR stand for?","Weekly Business Review",["Weekly Budget Report","Weekend Backlog Reset","Work Better Rhythm"],"MBR is the monthly version.",G)
q(B,"easy","What does EOD stand for?","End of Day",["End of Delivery","Estimated Order Date","Every Other Day"],"EOW is End of Week.",G)
q(B,"medium","What does MBO stand for?","Management by Objectives",["Monthly Budget Outlook","Manufacturing Batch Order","Marketing by Opportunity"],"A management framework.",G)
q(B,"medium","What does ARPP stand for?","Average Revenue Per Practice",["Annual Refab Planning Process","Account Renewal Pricing Plan","Average Return Per Product"],"A revenue metric.",G)
q(B,"medium","What does CAC stand for?","Customer Acquisition Cost",["Clinical Assessment Code","Crown And Cap","Case Approval Committee"],"A GTM metric.",G)
q(B,"medium","What does GTM stand for?","Go To Market",["Great Team Meeting","Guided Tooth Movement","Global Trade Management"],"Listed in the glossary.",G)
q(B,"medium","What does SLA stand for?","Service Level Agreement",["Scan Level Assessment","Standard Lab Allowance","Support Lead Approval"],"Listed in the glossary.",G)
q(B,"easy","What does SOP stand for?","Standard Operating Procedure",["Scan Order Process","Support Operations Plan","Senior Ops Partner"],"Listed in the glossary.",G)
q(B,"medium","QA and QC both appear in the glossary. What does QC stand for?","Quality Control",["Quick Check","Quantity Count","Queue Control"],"QA is Quality Assurance.",G)
q(B,"medium","What does CSAT stand for?","Customer Satisfaction",["Customer Support Action Team","Clinical Scan Accuracy Test","Case Status And Tracking"],"A customer sentiment metric.",G)

# ---------- Dental Terms ----------
q(D,"easy","In tooth-surface notation, what does 'D' stand for?","Distal",["Dorsal","Dental","Deep"],"Distal faces away from the midline.",G)
q(D,"easy","A surface labeled 'BL' combines which two surfaces?","Buccal and Lingual",["Bite and Lip","Bottom and Left","Buccal and Labial"],"B = Buccal, L = Lingual.",G)
q(D,"easy","What does 'O' stand for in tooth-surface notation?","Occlusal",["Oral","Outer","Open"],"The chewing surface.",G)
q(D,"medium","What does 'I' stand for in tooth-surface notation?","Incisal",["Interior","Inferior","Implant"],"The cutting edge of front teeth.",G)
q(D,"medium","FPD is another name for which restoration?","A bridge",["A night guard","A denture adhesive","A crown only"],"FPD = Fixed Partial Denture, AKA bridge.",G)
q(D,"medium","What does FCZ stand for?","Full Contour Zirconia",["Fully Cast Zirconium","Final Crown Zone","Fabricated Ceramic Zirconia"],"A monolithic zirconia crown.",G)
q(D,"medium","What does PFM stand for?","Porcelain Fused to Metal",["Precision Fit Margin","Partial Fixed Mold","Porcelain Finished Material"],"A classic crown type.",G)
q(D,"hard","What does FCC stand for in dental terms?","Full Cast Crown",["Full Ceramic Cap","Fixed Crown Casting","Fabricated Crown Core"],"A metal crown.",G)
q(D,"hard","What does VDO stand for?","Vertical Dimension of Occlusion",["Variable Digital Output","Verified Design Order","Vertical Denture Opening"],"Listed in the glossary.",G)
q(D,"hard","What does POI stand for in dental design?","Path of Insertion",["Point of Interest","Prep Over Impression","Placement of Implant"],"The direction a restoration seats.",G)
q(D,"hard","What does HOC stand for?","Height of contour",["Hold on Crown","Hygiene Oral Care","Heat of Cure"],"Listed in the glossary.",G)
q(D,"hard","What does TOM stand for?","Tissue Over Margin",["Tray Of Molds","Time On Mill","Tooth Outline Map"],"Listed in the glossary.",G)
q(D,"hard","What does CUP stand for?","Crown under Partial",["Custom Upper Prosthesis","Cap Under Plate","Crown Under Pontic"],"Listed in the glossary.",G)
q(D,"hard","What does TTP stand for in partials?","Temporary Treatment Partial",["Tooth Tracking Protocol","Total Turnaround Period","Try-in Test Piece"],"Listed in the glossary.",G)
q(D,"medium","What does SB stand for in implant cases?","Scan Body",["Soft Bite","Shade Book","Standard Bridge"],"Used to capture implant position.",G)
q(D,"medium","NTI is a type of what?","A mouthguard that prevents clenching",["A zirconia block","A scanner tip","A denture adhesive"],"NTI = Nociceptive Trigeminal Inhibitor.",G)
q(D,"medium","SRP is also known as what?","Deep cleaning",["Whitening","Root canal","Crown prep"],"SRP = Scaling and Root Planing, a procedure to treat gum disease.",G)
q(D,"medium","What does FLD stand for?","Full Lower Denture",["Fixed Lower Dentition","Final Lab Drawing","First Lower Digital"],"FUD is Full Upper Denture.",G)
q(D,"medium","What does NG stand for in a dental order?","Night guard",["Next Generation","No Gap","New Grind"],"Listed in the glossary.",G)
q(D,"easy","What does RDH stand for?","Registered Dental Hygienist",["Regional Dental Head","Restorative Design Hub","Registered Denture Holder"],"RDA is Registered Dental Assistant.",G)
q(D,"medium","What does CDT stand for?","Certified Dental Technician",["Computer Dental Tool","Crown Design Technique","Clinical Denture Trainer"],"Listed in the glossary.",G)

for i, x in enumerate(Q, 1):
    x["id"] = "q%03d" % i
texts = [x["question"] for x in Q]
assert len(set(texts)) == len(texts), "duplicate question text"
json.dump(Q, open("data/questions.json", "w"), indent=1, ensure_ascii=False)
print("questions:", len(Q))
print(collections.Counter(x["category"] for x in Q))
print(collections.Counter(x["difficulty"] for x in Q))
