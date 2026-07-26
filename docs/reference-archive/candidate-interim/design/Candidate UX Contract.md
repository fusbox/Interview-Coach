# Candidate UX Contract

Status: Historical reference

> [!WARNING]
> This file is archived historical context and does not govern current V2 implementation.
*This is a working, disposable spec doc*

### Model journey

> Host platform -> job listing -> launch

* Context: User has a specific target role in mind when they land in the app

> Generate question set -> landing page

* Coach has context from target role, JD, resume, stage, and count - landing page should present the question plan - similar to what the recruiter app now has - as context for user orientation and expectation-setting.

> Pre-session confidence level in landing page-> start session -> respond/feedback/retry/next loop -> post-session confidence level in exit page -> dashboard

* Note: This is a new flow - no more summary debrief in its current form since the dashboard supports post-session learning insights. Exit page can recap session highlight, but the primary CTA is Back to Dashboard.
* Note: Need to implement pre-/post-session confidence feedback component.

> Dashboard is the primary surface for self-regulated learning and coach-led performance improvement activities. The generalized engagement loop after a session is dashboard -> explore new/historical preparedness indicators -> engage in coach-recommended follow-up practice activities.

### Dashboard components

* Current-state preparedness based on all practice activities
* Last-session insights
* Next recommended practice - see item 2 in the below TBD section

##### Current-state preparedness

###### On entry: Graphical, high-level appraisal of prep state with contextual coach read

* Graphic - (tentative) sphere with prep-state color as calculated gradient value
* Current coach read card component

###### On click/tap of entry graphic: Animate transition to data visualizations of skill lane/dimension prep state

* Skills - [Two Level Pie Chart](https://recharts.github.io/en-US/examples/TwoLevelPieChart/)

  * Segments show prep-state color as calculated gradient value
  * Inner pie - 3 lane segments
  * Outer pie - 9 dimension segments aligned to their parent lane
* Category coverage - [Pie Chart with gap and rounded corne](https://recharts.github.io/en-US/examples/PieChartWithPaddingAngle/)

###### On click/tap of any inner or outer segment: Retain current behavior for now (modal drilldown)

---

### Current thinking on TBD UI

1. Decide the final mix of dashboard components and their grid - in addition to the above, last-session insights UI, next recommended practice (see below), user confidence, past activity
2. **Next practice recommendations**: We set these parameters to drive recommended practice UI.

   1. For a given target role, JD, and stage, we define **interview preparedness** as performance against skill dimensions across a question set providing sufficiently broad question category coverage for the stage.
   2. The coach will recommend more practice until there is a determination of **mastery** across all scorable signals for all relevant question categories.
   3. The **stage** provided sets the category **range** and evaluation **rigor** used to determine **mastery**.
   4. **Rigor:** For this release, **rigor** is encoded as the number of evaluable signals, built from a question count baseline appropriately distributed across categories using the existing question plan logic. For example, screening and general practice can use a 5-question baseline, 7 for first interviews, and 10 for final interviews, each using its question plan. If the initial practice round had been configured to generate a question set that has fewer questions than the minimum required for adequate rigor, coaching will still recommend questions to practice next even if the candidate finishes the initial round and performs strongly on all submitted responses. If the initial practice round had more questions resulting in greater rigor than the baseline for the stage selected, mastery/practice recommendations will be evaluated against the actual question set configured.
   5. **Mastery** of a given prep context is defined as strong performance in all scored signals that the coach is confident will remain stable in future performances. See open question below.
   6. Skill dimensions are tiered based on how foundational it is to preparedness and used in prioritizing next recommended practice. See open question below.
   7. Next recommended practice UI is perhaps better implemented as a list or bucket of 'To Practice' items, priority-sorted, with brief coach guidance text to contextualize the recommendations. Items are constructed at a granular level and presented/grouped by question category and lane. Users can select one or more items from a grouping to configure the next practice round. This provides user control and autonomy in a goal-directed, achievement-oriented way.

**Example 1 - Screening, 3 questions in initial round:**

- App logic assigns question plan, e.g., 1 question each for Screening, Behavioral, and Culture/Fit.
- Baseline rigor requires 5 questions for this stage, e.g., 2 Screening, 1 Behavioral, 1 Culture/Fit, 1 Technical/Role-Specific
- Prep state deconstructs to 5 questions x 9 possible dimensions/question = up to 45 possible evaluation data points
- Candidate rates Strong for questions 1 (Screening) and 3 (Culture/Fit), Clear on question 2 (Behavioral) due to suboptimal performance in one Substance dimension and one Structure dimension. Note, prep state presentation in the dashboard currently only uses the last submitted response when a question is retried, even if the retry results in regression. This is okay for the current scope.
- The 'To Practice' affordance presents next recommended practice items as 1. Practice question 2, 2. Present a 2nd Screening question to practice, 3. Present a Technical/Role-Specific question to practice. Exact copy of these TBD.
- Candidate can choose 1, 2, or all recommended practice items.
- After the 2nd round, app logic updates the items in 'To Practice'. Since there's now full category coverage against baseline rigor between the initial round and the new to-practice questions, no additional questions would ever need to be added to 'To-Practice' going forward.

**Example 2 - First Interview, 10 questions in initial round:** Here, the app uses the 10-question configuration to determine mastery and the items to place in 'To-Practice'. No new questions would ever need to be created in this scenario.


**3. In-session UI for follow-up practice rounds:** Since there can be as few as one dimension targeted for further practice, follow up sessions would add coach guidance in each active question screen with the needed context for what's being targeted for improvement vs where they already performed well to guard against regression, which could be frustrating if left unaddressed. Session behavior would otherwise remain unchanged.

---

### Open questions

1. For 2.5 above, For this release, the question is whether the currently implemented preparedness logic driving the consolidated prep state across practice rounds is satisfactory.
2. For 2.6 above, confirm where dimensional foundation level is set. Is ai-service.ts starting at line 83 being used for this? If so, is it correctly factored?
3. The recruiter app now previews the question plan from the stage/count the recruiter defines, and we're planning a similar affordance for the candidate app landing page. We'd want to make sure that there's question plan parity between recruiter and candidate apps.
4. In-session narrative feedback - what it decides to surface, how it characterizes areas for improvement, and what it presents as the biggest lift - use logic separate from what drives dashboard UI. Check if dashboard logic or in-session feedback logic seems more well-defined and see how we might better align the two. I've seen instances where some of the guidance doesn't seem to track as tightly as would be ideal.























































