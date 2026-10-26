#!/usr/bin/env python3
"""Generates data/questions-lead.json (the Lead Edition bank).
Run from the project root:  python3 scripts/build_lead_questions.py
Privacy rule used when writing these: no people's names, no individual performance/pay/hiring details.
"""
import json, collections

GEN = "Common workplace/tech usage"
GL = "Dandy Glossary & Acronyms (uploaded PDF)"
TL = "Slack #team-training-leads (private channel)"
TO = "Slack #training-team-ops (private channel)"
ALL = "Slack #all-dandians / #cheers-around-the-world"
DM = "Slack DMs (paraphrased, unattributed)"
POL = "Training Defined Time Off Policy (Google Doc, last edited Sep 2026)"

TECH = "Tech Shorthand"; WALK = "Walk the Floor"; PLAY = "Launch Playbook"
SCORE = "Scorecard & Metrics"; TOOLS = "Tools & Systems"; TIME = "Time Off Policy"; TERMS = "Training Terms"

Q = []
def q(cat, diff, text, correct, wrong, expl, src):
    assert len(wrong) == 3 and correct not in wrong and len(set(wrong)) == 3, text
    Q.append(dict(category=cat, difficulty=diff, question=text, correct=correct, wrong=wrong, explanation=expl, source=src))
def seen(ch): return GEN + "; seen in use in Slack " + ch

# ================= Tech Shorthand =================
q(TECH,"easy","What does TL;DR stand for?","Too long; didn't read",["Time left; deadline reached","Talk later; do review","Task list; daily report"],"It introduces a short summary, and people use it in Dandy tickets and threads all the time.",seen("#cx-product-support, #epd-cad-support"))
q(TECH,"easy","A teammate starts an escalation with \"TLDR:\". What are they giving you?","A short summary up front",["A deadline","A list of attendees","A request for approval"],"TLDR leads the one-or-two-line version of a longer message.",seen("#cx-product-support"))
q(TECH,"easy","Someone says \"let's take this offline.\" What do they mean?","Continue the discussion outside this meeting or thread",["Pause until the internet is back","Cancel the project","Hand it to legal"],"Typically a DM, a 1:1 or a quick call.",seen("#service-delivery-wbr, #cx-product-support"))
q(TECH,"medium","Why do people say \"let's take this offline\" in a big meeting?","To avoid derailing the group and sort details with the people involved",["Because the meeting is being recorded","Because the topic is confidential from HR","Because the Wi-Fi is bad"],"It keeps the room on the agenda while the detail gets handled separately.",GEN)
q(TECH,"easy","What does ICYMI mean?","In case you missed it",["I can't make it in","It's critical, my inbox","In case you may inquire"],"Used to resurface something important.",seen("#epd-ai, #temp-aio-1-1-relaunch-working-group"))
q(TECH,"easy","In a code or doc review, LGTM means what?","Looks good to me",["Let's get the meeting","Late, going to miss","Leave given to manager"],"A sign-off, common in pull-request reviews.",GEN)
q(TECH,"easy","What does WIP stand for?","Work in progress",["Weekly impact plan","Waiting in pipeline","Wrap it up"],"Not finished yet, but shared for visibility.",GEN)
q(TECH,"easy","What does OOO mean in a calendar or status?","Out of office",["Out of order","On our own","Only one option"],"Don't expect a quick reply.",GEN)
q(TECH,"easy","What does FYI stand for?","For your information",["Follow your instincts","Finish by yesterday, immediately","From your inbox"],"A heads-up that needs no action.",GEN)
q(TECH,"medium","In engineering, what does PR stand for in \"can you review my PR?\"","Pull request",["Product release","Priority review","Process rollout"],"A proposed code change awaiting review.",seen("#epd-production-management-pr-reviews"))
q(TECH,"medium","What does NRN mean at the end of a message?","No reply needed",["Next review needed","Not right now","New resource needed"],"Saves everyone an unnecessary \"thanks!\".",GEN)
q(TECH,"medium","What does AFAIK stand for?","As far as I know",["Always follow all instructions, kindly","A final answer is known","Ask for another idea, kindly"],"Signals you're not 100% certain.",GEN)
q(TECH,"medium","What does IMO stand for?","In my opinion",["It must occur","Immediate move required","Is more optional"],"Marks a view, not a fact.",GEN)
q(TECH,"easy","What does WFH stand for?","Work from home",["Week for help","Weekly field hours","Walk the floor, honestly"],"Dandy has a WFH equipment stipend for remote setups.",seen("#trainer-onboarding"))
q(TECH,"easy","What does PTO stand for?","Paid time off",["Planned task order","Priority training overview","Part-time only"],"Time off that is paid.",POL)
q(TECH,"medium","In support and training, what does KB stand for?","Knowledge base",["Key benchmark","Kickback","Kilobyte batch"],"Where SOPs and help articles live. Trainers were told to re-bookmark links after a KB reorganization.",seen("#training-team-ops"))
q(TECH,"medium","What is a \"1:1\"?","A one-on-one meeting between two people",["A one-to-one ratio of trainers to practices","A first-order discount","A single-order launch"],"Leads run regular 1:1s with their trainers.",GEN)
q(TECH,"medium","What does it mean to do something \"async\"?","Without everyone needing to be online at the same time",["Automatically, with no review","At a slower pace on purpose","In a meeting with video on"],"A written update instead of a live meeting.",seen("#training-team-ops"))
q(TECH,"medium","\"Let's circle back on that\" means what?","Return to the topic later",["Start the meeting over","Cancel the topic","Repeat the last slide"],"A polite way of parking something.",GEN)
q(TECH,"medium","What does \"unblock\" mean?","Remove whatever is stopping someone's progress",["Reopen a closed ticket","Approve a purchase","Restore a deleted file"],"The Lead Project Tracker exists partly to help leads unblock each other.",seen("#team-training-leads"))
q(TECH,"medium","If someone says they don't have the \"bandwidth,\" what do they mean?","They don't have the capacity for more work",["Their internet is slow","They need a bigger budget","They disagree with the plan"],"It's about time and attention, not Wi-Fi.",GEN)
q(TECH,"medium","In the Dandy glossary, an RFC is a...","Request for Comment, a proposed project or initiative",["Required for customer","Refab for credit","Rapid field check"],"Used to gather feedback before building.",GL)
q(TECH,"easy","In the Dandy glossary, what does DRI stand for?","Directly Responsible Individual",["Dentist Request Intake","Design Review Initiative","Daily Routine Item"],"The one person ultimately responsible for a decision or project.",GL)
q(TECH,"easy","What does EOD mean?","End of day",["End of delivery","Every other day","Estimated order date"],"\"Please acknowledge by EOD\" means before the day finishes.",GL)
q(TECH,"medium","What does EOM mean in a lead metrics review?","End of month",["End of meeting","Estimate of margin","Every other Monday"],"Leads review last month's numbers at EOM.",TL)
q(TECH,"medium","In a ticket, what is \"ETA?\" usually asking for?","An expected completion time",["The next escalation tier","An exact assignee","A payment amount"],"The glossary expands ETA as Estimated Time of Arrival.",GL)
q(TECH,"medium","What does SSO stand for?","Single sign-on",["Secure support option","Standard scanning order","System status overview"],"One login that works across several tools.",GEN)
q(TECH,"medium","What does MFA stand for?","Multi-factor authentication",["Managed field access","Maximum file allowance","Main frame archive"],"A second check beyond a password. It matters given the recent phishing warnings.",seen("#always-be-learning"))
q(TECH,"medium","What does API stand for?","Application programming interface",["Automated process indicator","Account payment integration","Applied project inventory"],"How one piece of software talks to another.",GEN)
q(TECH,"medium","What does LLM stand for?","Large language model",["Limited license manager","Lab logistics module","Long-lead material"],"The kind of AI behind tools like Claude.",seen("#epd-ai"))
q(TECH,"medium","DANTE is an in-house ML model. What does ML stand for?","Machine learning",["Manual labor","Material list","Mesh library"],"DANTE generates crown designs.",GL)
q(TECH,"easy","What does DM stand for in Slack?","Direct message",["Daily metric","Design module","Delivery manager"],"A private message to one person or a small group.",GEN)
q(TECH,"medium","The Training Newsletter Compliance app is fed with a weekly what kind of file?","CSV (comma-separated values)",["PDF","MP4","PPTX"],"A CSV is downloaded from The Bite and uploaded each Monday.",TO)
q(TECH,"medium","What does NPS stand for?","Net Promoter Score",["New product spec","National provider status","Next practice step"],"A common customer-loyalty metric.",GEN)
q(TECH,"medium","In the handoff channel name \"smb-to-enterprise\", what does SMB stand for?","Small and medium-sized business",["Scan-based billing","Scheduled monthly bundle","Senior management briefing"],"Practices are routed differently as they grow.",seen("#smb-to-enterprise-handoff"))
q(TECH,"medium","What does MVP mean in product work?","Minimum viable product",["Most valuable player","Maximum volume plan","Managed vendor process"],"The smallest version worth testing with real users.",GEN)
q(TECH,"medium","What does POC stand for in tech?","Proof of concept",["Point of care","Process owner check","Practice order count"],"A small experiment to show something can work.",GEN)
q(TECH,"easy","In a doc or ticket, \"TBD\" means what?","To be determined",["To be delivered","Training by default","Task before deadline"],"Not decided yet.",GEN)
q(TECH,"medium","What does WBR stand for?","Weekly Business Review",["Weekly budget report","Walk-the-floor briefing round","Work breakdown review"],"Leads prepare their misses for it.",GL+"; "+TL)
q(TECH,"hard","MECE is a way of structuring problems. What does it stand for?","Mutually Exclusive, Collectively Exhaustive",["Measured, Evidenced, Clear, Effective","Managed, Escalated, Closed, Executed","Most Efficient, Cost-Effective"],"Categories don't overlap and together cover everything.",GL)

# ================= Walk the Floor =================
q(WALK,"easy","Which of these is one of Dandy's named drivers?","Walk the Floor",["Hit the Quota","Stay in Your Lane","Keep It Quiet"],"Walk the Floor sits alongside Move at Dandy Speed, See Tomorrow Clearly, Obsess Over Customers and Win as One.",ALL)
q(WALK,"easy","Which Dandy driver is represented by a boot icon?","Walk the Floor",["Win as One","See Tomorrow Clearly","Move at Dandy Speed"],"The boot emoji is the Walk the Floor icon in Slack.",ALL)
q(WALK,"medium","Which Dandy driver is about working fast?","Move at Dandy Speed",["Win as One","Obsess Over Customers","See Tomorrow Clearly"],"One of the named drivers.",ALL)
q(WALK,"medium","Which Dandy driver is about collaborating as a team?","Win as One",["Walk the Floor","Move at Dandy Speed","See Tomorrow Clearly"],"One of the named drivers.",ALL)
q(WALK,"medium","Per a company-wide post, walking the floor means what?","Listening to customers, reading every piece of feedback and doing the little things",["Reviewing dashboards from your desk","Waiting for escalations to arrive","Handing all customer contact to support"],"It's about getting close to the customer and the work.",ALL)
q(WALK,"medium","One teammate \"walks the floor\" on every case she reviews. How?","By imagining herself performing each step to fabricate the restoration",["By re-measuring every scan","By visiting each practice","By writing a summary for every case"],"She places herself in the steps from seating the patient through fabrication to delivery.",ALL)
q(WALK,"hard","A competency is low across a team. What does a lead's floor walk look like?","Listen to calls: are they even doing it? If not, find out why, then coach that reason",["Send a team-wide reminder","Add the competency to a dashboard and wait","Remove it from the scorecard"],"The floor walk is to investigate the behavior and the blocker, not just the number.",DM)
q(WALK,"medium","A doctor had just texted a trainer. The lead coached the trainer to call instead. Why?","To work through the objection live and get a stronger commitment",["Calls are cheaper than texts","Texts can't be logged in Salesforce","Doctors never read texts"],"A call lets you create urgency and lock a clear next step.",TL)
q(WALK,"medium","In that coaching win, what created urgency with a doctor who would be away for about 12 days?","Not wanting to start from scratch again when they returned",["A discount about to expire","A scanner recall","The practice's lease ending"],"Acting while training was fresh led to a same-day working session.",TL)
q(WALK,"medium","What is a \"boomerang\" practice?","A practice that previously churned and is working with Dandy again",["A practice that reorders every week","A practice that returns scanners","A practice referred by another practice"],"A trainer argued these practices need special care.",TO)
q(WALK,"hard","A trainer argued boomerang practices need support through at least which order?","Order 10",["Order 2","Order 5","Order 25"],"It's a rare chance to work with them again.",TO)
q(WALK,"medium","A trainer argued that customers aren't successful in Month 2 without what?","Continued trainer support",["A second scanner","A pricing change","A new portal"],"Success past the first 30 days needs ongoing support.",TO)
q(WALK,"medium","Before committing a staff case in a launch, what should a trainer ask first?","Whether there's a live patient in the next 2 business days",["Whether the doctor has CEREC","How many scanners the office has","Who will pay for the case"],"Scanning a staff member is the fallback.",TL)
q(WALK,"hard","In recent QA data, Case Commitment passed more often when a trainer did what?","Asked about a live patient in the next 2 business days first",["Skipped the staff scan","Booked the follow-up by text","Shortened the launch"],"Launches with a live-patient case inside the window passed far more often.",TO)
q(WALK,"hard","A lead's analysis found which readiness gap mattered more than equipment delays?","Practices not logging in to the portal before launch",["Wrong tip sizes","Late shipping labels","Missing training decks"],"Equipment delays touched only a small slice of launches.",TO)
q(WALK,"hard","Equipment delays touched roughly what share of launches in that analysis?","About 2%",["About 20%","About 40%","About 60%"],"A small slice, with ramp rates about the same as everyone else.",TO)
q(WALK,"hard","Trainers said they weren't confident telling which scanners apart?","Vision, Trios 3 and Trios 5",["Vision and Chairside","Trios 3 and Aligner","DANTE and DDE"],"Calls showed Vision habits carrying over to Trios launches.",TO)
q(WALK,"hard","Which Vision habit was stalling Trios 3 launches?","Telling the office there's no calibration",["Skipping the bite scan","Using the wrong shade guide","Scanning with tips off"],"Trios 3 offices needed calibration, so the launch stalled.",TO)

# ================= Launch Playbook =================
q(PLAY,"medium","When a practice needs a follow-up training, what should be offered first?","A virtual follow-up",["A field follow-up by the original trainer","A price credit","A brand-new launch"],"Field follow-ups are one of the most expensive investments in time and travel.",TL)
q(PLAY,"medium","Virtual follow-ups for aligners, sleep and implants go first to which team?","The STS team",["The CST","The BDR team","The PPR team"],"STS = Sales and Training Specialist.",TL+"; "+GL)
q(PLAY,"medium","If virtual isn't a good fit and a doctor truly needs a field follow-up, how is it requested?","Through TC Escalations",["Directly on the trainer's own calendar","By email to the doctor","By a Slack DM to a random trainer"],"After a clear attempt to reassure the customer virtually.",TL)
q(PLAY,"medium","Which of these can field trainers no longer do?","Assign a follow-up training to themselves",["Offer a virtual follow-up","Request a TC escalation","Reassure the customer"],"Self-assigned follow-ups hurt capacity and travel balance.",TL)
q(PLAY,"medium","In scheduling, what does DNR mean?","Do not reassign",["Did not respond","Delivered, no review","Design needs rework"],"Trainers can no longer mark a practice DNR themselves.",TL)
q(PLAY,"hard","Why do self-assigned field follow-ups put launches at risk?","They limit capacity and can make travel to nearby launches impossible",["They lower the trainer's scorecard","They skip the customer's approval","They break the Salesforce sync"],"A cross-country follow-up can block the next day's launch.",TL)
q(PLAY,"medium","A practice requests a specific trainer. What can that trainer offer?","An order review with themselves when they're available",["A field visit on any date","A free scanner","A new launch date"],"Otherwise lean toward virtual, and escalate only if needed.",TL)
q(PLAY,"medium","When a launch is split in two, who schedules Part 2?","The same trainer who ran Part 1",["Whoever has the lightest calendar","The training coordinator, any trainer","The practice"],"A clear standard to avoid ownership confusion.",TL)
q(PLAY,"medium","Who owns a split launch for completion metrics and case-submission credit?","The trainer who completed Part 1",["The trainer who finishes Part 2","The lead","Whoever the AE chooses"],"The owner of record defaults to Part 1.",TL)
q(PLAY,"hard","If Part 2 has to go to a different trainer, what should happen?","Document the reassignment",["Nothing, it's automatic","Notify the practice by text","Reset the metrics"],"So it's clear who owns the outcome later.",TL)
q(PLAY,"medium","Which calendar should trainers treat as the primary source of truth?","Their Salesforce calendar",["Their personal phone calendar","The shared team spreadsheet","Google Calendar"],"Salesforce-to-Google sync issues are being fixed, so Salesforce wins.",TO)
q(PLAY,"medium","How should a trainer's approved time off be recorded?","Submitted through their lead so it's added to Salesforce",["Typed onto their Google Calendar","Posted in the team channel","Written in their 1:1 doc"],"Trainers should not put time off on their Google Calendar.","Slack #training-bizsystems (private channel)")

# ================= Scorecard & Metrics =================
q(SCORE,"medium","How many competencies are on the Launch Outcome Scorecard?","Five",["Three","Seven","Ten"],"Features → Value, Case Commitment, Objections, Urgency and Next Touch Point.",TO)
q(SCORE,"medium","Which of these is NOT one of the five Launch Outcome competencies?","Scanner calibration",["Features → Value","Case Commitment","Urgency"],"The five are Features → Value, Case Commitment, Objections, Urgency and Next Touch Point.",TO)
q(SCORE,"medium","Which competency is about tying product features to what matters to the practice?","Features → Value",["Next Touch Point","Urgency","Objections"],"Translating features into practice value.",TO)
q(SCORE,"medium","Which competency is about ending with a specific, dated follow-up?","Next Touch Point",["Case Commitment","Urgency","Features → Value"],"Does the call end with a dated next step?",TO)
q(SCORE,"medium","Which competency is about giving the practice a reason to act now?","Urgency",["Objections","Next Touch Point","Case Commitment"],"A trainer who creates urgency avoids stalls.",TO)
q(SCORE,"medium","Which competency is about resolving a doctor's concerns?","Objections",["Urgency","Features → Value","Case Commitment"],"Handling pushback in the moment.",TO)
q(SCORE,"medium","What does \"All 5 Passed\" mean?","A launch passed all five competencies",["Five launches in a row passed","The trainer passed five calls","Five practices ordered"],"It is the headline standard.",TO)
q(SCORE,"hard","Why use \"All 5 Passed\" instead of a blended average?","So a strong score in one competency can't hide a gap in another",["It's easier to calculate","Averages are not allowed in Attention","It makes the numbers look higher"],"No blended averages.",TO)
q(SCORE,"medium","What does \"3 in 14\" mean?","A practice places 3 orders within 14 days",["3 trainings in 14 days","3 follow-ups in 14 days","3 scanners in 14 days"],"A key early-ramp measure.",TO)
q(SCORE,"hard","Which behavior was linked to practices hitting 3 in 14 more often?","Securing a dated case commitment",["Giving a longer demo","Offering a credit","Scheduling a second launch"],"Resolving objections showed a similar gap.",TO)
q(SCORE,"medium","The weekly Training QA summary is built from calls tagged as what?","Launch Training, Follow-Up Training or Follow Up Call",["Sales Demo, Renewal or Onboarding","Support, Billing or Escalation","Any call longer than 5 minutes"],"Untagged or mis-tagged calls aren't included.",TO)
q(SCORE,"medium","Which tool scores every launch on the Launch Outcome Scorecard?","Attention",["Zendesk","Looker","CloudTalk"],"Attention records, scores and links to call recordings.",TO)
q(SCORE,"medium","When does the automated weekly Training QA summary post in the ops channel?","Monday morning",["Wednesday afternoon","Friday evening","The 1st of each month"],"It links to a Slack Canvas coaching workbench.",TO)
q(SCORE,"medium","What is the Weekly QA Coaching Canvas for?","Trainer-by-trainer breakdowns, flagged recordings and model calls for coaching",["Booking field follow-ups","Approving time off","Tracking equipment shipments"],"Leads prep their weekly coaching plans from it.",TO)
q(SCORE,"hard","How is each lead's weekly coaching priority chosen?","Their team's lowest-scoring competency is named",["The lead picks any one","The highest-scoring competency","The one with the most calls"],"One coaching priority per team, so the week has a clear focus.",TO)
q(SCORE,"hard","In recent QA analysis, objection failures were far more common when which competency also failed?","Case Commitment",["Urgency","Next Touch Point","Features → Value"],"The two tend to fail together.",TO)
q(SCORE,"medium","As Dandy moves to a 15-order model, trainers are coached to act more like what?","Owners of their practices rather than task takers",["Product demonstrators","Support agents","Scheduling coordinators"],"Account owners, not educational leaders.",DM)

# ================= Tools & Systems =================
q(TOOLS,"easy","What is The Bite?","Dandy's internal knowledge hub for newsletters, policies and calendars",["A weekly lunch order","The company podcast","A scanner firmware update"],"Newsletters, HR pages, holiday calendars and stipend info live there.",TO+"; Slack #cx-mgmt-updates, #trainer-onboarding")
q(TOOLS,"medium","Trainers must do what with each weekly training newsletter in The Bite?","Acknowledge it",["Print it","Forward it to a practice","Rewrite it for their pod"],"Acknowledgment is tracked and reminded each week.",TO)
q(TOOLS,"medium","The weekly Letter AI role play is posted Monday. When is it due?","Friday",["Tuesday","Wednesday","The following Monday"],"It takes 5 to 10 minutes, so do it early.",TO+"; Slack lead team rhythm post")
q(TOOLS,"medium","What does Letter AI give trainers?","AI role-play practice",["A call phone line","A scheduling calendar","A scanner simulator"],"Role plays cover skills like case commitment.",TO)
q(TOOLS,"medium","What is CloudTalk used for?","Phone calls with practices",["Design review","Expense approval","Equipment tracking"],"Leads listen to calls there to get close to customers.",TL)
q(TOOLS,"medium","What is Dandy Vibes?","An internal platform for building and hosting Dandians' own apps",["A customer app store","The company holiday calendar","A scanner accessory"],"The Lead Project Tracker and the newsletter compliance view run on it.",ALL+"; "+TL)
q(TOOLS,"medium","About how long should the weekly Lead Project Tracker update take?","5 to 10 minutes",["1 hour","30 minutes","Half a day"],"A quick weekly update on active items, used to unblock each other.",TL)
q(TOOLS,"hard","Leads approve Deel reimbursement requests for international trainers by when?","The 15th of each month",["The last day of the month","Within 24 hours","Quarterly"],"A reminder from training ops. Finance may change platforms later.",TO)
q(TOOLS,"medium","Where can you find WFH equipment and gym stipend details?","The Bite",["The scanner manual","A trainer's offer letter","Zendesk macros"],"Reviewing the expense policy is part of week one.","Slack #trainer-onboarding (private channel)")

# ================= Time Off Policy =================
q(TIME,"easy","How much PTO does a full-time employee on the Training team receive per year?","20 days (160 hours)",["10 days (80 hours)","15 days (120 hours)","30 days (240 hours)"],"Issued on an accrual basis.",POL)
q(TIME,"medium","How is PTO issued over the year?","Accrued equally across each paycheck",["All at once in January","Quarterly","After each full year of service"],"Prorated in the first calendar year.",POL)
q(TIME,"medium","How many days of un-accrued PTO can an employee borrow in a calendar year?","Up to 5 days",["None","Up to 2 days","Up to 10 days"],"Borrowed time is owed back if they leave before accruing it.",POL)
q(TIME,"medium","How much unused PTO can roll over to the next calendar year?","Up to 5 days (40 hours)",["Nothing","Up to 10 days","All of it"],"Anything beyond that is paid out.",POL)
q(TIME,"easy","How much protected sick time (STO) do employees get each year?","80 hours (10 days)",["40 hours (5 days)","120 hours (15 days)","160 hours (20 days)"],"Front-loaded at the start of the calendar year.",POL)
q(TIME,"medium","Does unused sick time roll over to the next year?","No, it expires",["Yes, up to 5 days","Yes, all of it","It's paid out at year end"],"Unless local law says otherwise.",POL)
q(TIME,"medium","In what increments can STO be used?","15 minutes",["1 hour","30 minutes","Half days only"],"No usage waiting period either.",POL)
q(TIME,"medium","How far in advance should PTO be requested to be protected time?","At least 2 weeks",["24 hours","1 week","1 month"],"Requests inside 2 weeks are treated differently.",POL)
q(TIME,"medium","What is a \"Capacity Day\"?","A day when approved PTO is already at capacity, so no more requests can be approved",["A day with extra training volume bonuses","A company holiday","A day with no field trainings"],"Even a request made 2+ weeks ahead can be denied.",POL)
q(TIME,"medium","What counts as Unapproved Time Off (UTO)?","A request made inside 2 weeks, on a Capacity Day, or beyond allotted time",["Any request over one day","Any request made on a Friday","A request made by a part-time employee"],"UTO is unprotected time.",POL)
q(TIME,"hard","As general guidance, up to what share of the applicable workforce can be approved off?","20%",["5%","50%","75%"],"The company makes the final call based on coverage.",POL)
q(TIME,"medium","When might HR ask for documentation for sick time?","After more than 3 consecutive days",["After any sick day","Never","After 1 hour"],"No doctor's note is required for fewer than 3 consecutive days.",POL)
q(TIME,"medium","A temporary personal internet outage lasts under an hour. What's the usual handling?","Make up the time by flexing within the same week, at the supervisor's discretion",["Automatically use PTO","Mark it as UTO","Nothing is needed"],"Multiple outages may require STO or PTO.",POL)
q(TIME,"medium","What internet speed does the policy recommend?","At least 25 Mbps up and down",["5 Mbps","10 Mbps","1 Gbps"],"More if streaming during the day (150-300 Mbps download).",POL)
q(TIME,"hard","What does Dandy 'may' provide for natural disasters that cause loss of power?","Up to 3 days of Natural Disaster Leave",["Up to 1 day","Up to 2 weeks","Nothing, ever"],"Not generally required by law, and at Dandy's discretion.",POL)
q(TIME,"medium","Who follows country-specific PTO guidelines issued by Deel?","International employees",["Part-time employees","New hires in week one","Pod leads"],"US full-time employees follow the training policy.",POL)
q(TIME,"medium","Who is eligible for PTO under the Training policy?","US-based full-time employees scheduled for 30+ hours a week",["Everyone including contractors","Anyone with a year of tenure","Only leads"],"Part-time employees remain eligible for STO and holidays.",POL)
q(TIME,"medium","How are holiday-adjacent time-off requests approved?","First come, first served, via the holiday PTO form",["By seniority","By lottery","By lead preference"],"Company holidays themselves need no request.","Slack #training_department, #team-training-leads (private)")
q(TIME,"medium","Which of these is a company holiday trainers don't need to request off?","The day after Thanksgiving",["Halloween","Columbus Day","New Year's Eve"],"Thanksgiving, the day after, Christmas Eve, Christmas and New Year's Day.","Slack #training_department (private)")
q(TIME,"medium","On days with no field trainings, like the day before Thanksgiving, are trainers off?","No, they're still work days; time off must be requested",["Yes, automatically","Only field trainers are off","Only virtual trainers are off"],"Field trainings just aren't scheduled.","Slack #training_department (private)")
q(TIME,"hard","Reimbursement expenses submitted more than 30 days later, what does the policy say?","They may be rejected",["They are always rejected","They are always approved","They need CEO approval"],"Leads decide based on history and context.","Slack #team-training-leads (private)")

# ================= Training Terms =================
q(TERMS,"easy","What does TC stand for on the training team?","Training Coordinator",["Team Captain","Territory Contact","Technical Consultant"],"TCs place calendar blocks and handle escalations.",GL)
q(TERMS,"medium","What does STS stand for?","Sales and Training Specialist",["Scan to Surface","Standard Turnaround Schedule","Support Team Supervisor"],"Specialists for aligners, sleep and implants follow-ups.",GL)
q(TERMS,"medium","What does KOC stand for?","Kick Off Call",["Key Operations Check","Knowledge of Crowns","Kit Order Confirmation"],"The call that starts a practice's journey.",GL)
q(TERMS,"medium","What does OBC stand for?","Onboarding Champion",["Order Batch Control","Office Billing Contact","Online Booking Calendar"],"See also Setup Champion.",GL)
q(TERMS,"medium","At Dandy, a \"ramped\" practice has how many lifetime orders?","50+",["10+","25+","100+"],"The glossary's definition.",GL)
q(TERMS,"hard","What does NTS stand for?","New Training Shipment",["Next Ticket Status","National Territory Sales","Night guard Tray Set"],"Listed in the glossary.",GL)
q(TERMS,"medium","What does CSL stand for?","Customer Success Lead",["Clinical Support Lead","Case Scheduling Log","Crown Service Level"],"A leadership role in CX.",GL)
q(TERMS,"medium","What does C+R mean?","Cancel and resubmit",["Check and Review","Credit and Refund","Crown plus Restoration"],"A workflow for customers and CX to self-service order changes.",GL)

for i, x in enumerate(Q, 1):
    x["id"] = "l%03d" % i
texts = [x["question"] for x in Q]
assert len(set(texts)) == len(texts), "duplicate question text"
json.dump(Q, open("data/questions-lead.json", "w"), indent=1, ensure_ascii=False)
print("lead questions:", len(Q))
print(collections.Counter(x["category"] for x in Q))
print(collections.Counter(x["difficulty"] for x in Q))
