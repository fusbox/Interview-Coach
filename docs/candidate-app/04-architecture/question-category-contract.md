# Question Category Contract

Status: Working contract
Last updated: 2026-06-13

## Purpose

This contract defines the candidate-facing and coach-facing meaning of Interview Coach question categories.

The category system answers a different question than the performance-lane system:

- Performance lanes answer: "How well did I answer?"
- Question categories answer: "What kind of interview demand did I practice?"

Canonical related docs:

- [SPEC](../SPEC.md)
- [DATA_CONTRACT](../DATA_CONTRACT.md)
- [Preparedness Signal Map](./preparedness-signal-map.md)

## Product Rule

Question categories are not performance lanes. They are the interview-demand axis of preparedness.

For this release:

- categories define the question plan and dashboard matrix rows;
- categories can carry candidate-facing feedforward and feedback indicators;
- category state is derived from practiced/scored answers only;
- unanswered questions can show coverage context, but must not count as zero-score evidence;
- detailed category claims should remain grounded in practiced question evidence.

## SRL Indicator Mapping

The category system supports the self-regulated learning cycle by helping the candidate understand the scope of practice.

| SRL stage | Candidate question | Category indicator role |
| --- | --- | --- |
| Goal | What kind of interview am I preparing for? | Show the relevant interview demands for the target role, JD, stage, and question count. |
| Plan | What types of questions might I need to practice? | Explain the category mix selected for the practice round. |
| Specify | What should I practice next? | Identify unpracticed or weaker categories that are useful to target next. |
| Perform | What am I doing in this question? | Provide concise category framing before or during a question when useful. |
| Perceive | What did I practice? | Show practiced and upcoming questions by category. |
| Interpret | What does my answer show for this category? | Explain category-specific strengths or gaps in candidate-safe language. |
| Compare | Is this enough for my interview goal? | Compare category evidence against the target interview scope without using numeric readiness claims. |

## Category Overview

| Category ID | Candidate-facing label | Core demand |
| --- | --- | --- |
| `screening` | Screening | Establish basic fit, interest, background, availability, and logistics. |
| `behavioral` | Behavioral | Recount a real past situation and show what the candidate personally did. |
| `culture_fit` | Culture / Fit | Show motivation, values alignment, work preferences, and self-awareness. |
| `case_scenario` | Scenario | Reason through an imagined situation, tradeoff, or realistic work problem. |
| `technical_role_specific` | Technical / Role-Specific | Demonstrate role knowledge, tools, processes, or domain-specific judgment. |

Candidate-facing labels may be shortened in compact UI, but category meaning should not drift.

## Category Contracts

### Screening

Candidate-facing definition:

> Screening questions check basic fit and practical alignment before a deeper interview.

Interviewer objective:

- Confirm the candidate understands the role at a basic level.
- Surface motivation, relevant background, availability, logistics, and obvious mismatches.
- Decide whether a deeper interview is worthwhile.

What the question asks the candidate to do:

- Explain interest in the role or company.
- Summarize relevant background.
- Answer availability, schedule, location, or work-authorization style questions when appropriate.
- Keep answers clear, concise, and professional.

Resume/JD use:

- JD can shape role-interest and basic fit questions.
- Resume content can help generate "tell me about your background" prompts.
- Resume content should not be used to fabricate unavailable logistics or personal details.

Coach evidence:

- Does the answer address the basic question directly?
- Does it connect the candidate's background to the role without overexplaining?
- Does it avoid vague enthusiasm or generic claims?
- Does it stay concise?

Common weak patterns:

- Too generic: "I just need a job."
- Too long for a screening context.
- No connection to the role/JD.
- Practical answer is missing when the question asks for logistics.

Feedforward indicators:

- What screening topics are likely in this stage.
- Which screening questions are upcoming in the planned round.
- A short reminder that screening answers should be direct and role-connected.

Feedback indicators:

- Whether the candidate gave a clear role-relevant answer.
- Whether background, motivation, or logistics were underdeveloped.
- Whether the answer was concise enough for a screening context.

Dashboard use:

- Screening appears as a question-category row.
- Screening state is based on practiced screening questions only.
- Screening can inform next practice when basic role interest/background answers are weak or unpracticed.

### Behavioral

Candidate-facing definition:

> Behavioral questions ask for a real past example.

Interviewer objective:

- Understand how the candidate has actually acted in prior situations.
- Look for ownership, judgment, collaboration, problem-solving, and outcomes.
- Infer future behavior from demonstrated past behavior.

What the question asks the candidate to do:

- Choose a relevant real experience.
- Set the situation briefly.
- Explain the candidate's personal role and action.
- Describe the result, learning, or impact.
- Connect the example back to the target role when useful.

Resume/JD use:

- Resume content can suggest relevant experience areas to invite.
- JD can shape which behavioral competencies matter most.
- Feedback can notice whether the chosen example makes good use of resume-visible experience.

Coach evidence:

- Is the example real and relevant?
- Is the candidate's personal action clear?
- Is there concrete detail?
- Is there an outcome or learning?
- Is the example connected to the role/JD?

Common weak patterns:

- Hypothetical answer instead of a real example.
- Team outcome without the candidate's contribution.
- Situation summary with little action.
- No result, learning, or role connection.

Feedforward indicators:

- Suggested story types based on role/JD/resume.
- Guidance that behavioral answers need a real example.
- Planned behavioral question count.

Feedback indicators:

- Whether the example was specific and role-relevant.
- Whether the answer showed personal action.
- Whether outcome or learning was explicit.

Dashboard use:

- Behavioral appears as a question-category row.
- It is a strong candidate for category-specific coaching because many answer-quality dimensions are visible in behavioral answers.
- Behavioral drilldowns should preserve the distinction between "good answer structure" and "good past-example selection."

### Culture / Fit

Candidate-facing definition:

> Culture and fit questions ask how the candidate works, what motivates them, and why the role makes sense.

Interviewer objective:

- Understand motivation, values, preferences, and working style.
- Check alignment with the team, environment, and role expectations.
- Assess self-awareness and authenticity.

What the question asks the candidate to do:

- Explain motivation or preferences honestly.
- Connect values or work style to the role context.
- Show self-awareness without over-sharing.
- Avoid generic enthusiasm.

Resume/JD use:

- JD can identify team environment, customer focus, pace, or collaboration expectations.
- Resume content can help connect prior environments to the target environment.
- Resume content should not force a culture/fit claim when no evidence exists.

Coach evidence:

- Does the answer sound specific to this role?
- Does it show thoughtful motivation?
- Does it reveal a work preference or value that fits the role?
- Does it stay professional and grounded?

Common weak patterns:

- Generic "I am a team player" language.
- Motivation not connected to the role.
- Overly personal or unfocused answer.
- Strong claims without evidence.

Feedforward indicators:

- What kind of work environment or motivation question may appear.
- A reminder to connect motivation to the role/JD.

Feedback indicators:

- Whether motivation sounded specific and credible.
- Whether values/work style were connected to role expectations.
- Whether the answer showed useful self-awareness.

Dashboard use:

- Culture / Fit appears as a question-category row.
- It may be emphasized during screening-focused practice but remains distinct from Screening.
- Category feedback should avoid making hiring-fit judgments; it should focus on answer clarity and role-specific motivation.

### Scenario

Candidate-facing definition:

> Scenario questions ask what the candidate would do in an imagined work situation.

Interviewer objective:

- Assess judgment, prioritization, tradeoff reasoning, and problem-solving.
- See how the candidate thinks through a realistic role situation.
- Evaluate calm decision-making when the candidate may not have a past example.

What the question asks the candidate to do:

- Understand the situation.
- Identify the priority or tradeoff.
- Walk through a reasonable action path.
- Explain why that approach fits the role.
- Mention escalation, communication, safety, or customer impact when relevant.

Resume/JD use:

- JD should shape realistic scenario conditions.
- Resume content can calibrate scenario difficulty or context, but the candidate is not expected to recount a past event.
- Strong-response examples should not invent past experience; they should model reasoning.

Coach evidence:

- Does the candidate identify the core problem?
- Does the answer include clear next steps?
- Does it explain why those steps make sense?
- Does it account for stakeholder, customer, safety, compliance, or operational tradeoffs when relevant?

Common weak patterns:

- Treating the scenario as a behavioral question without answering what they would do.
- Jumping to a solution without explaining reasoning.
- Over-escalating without taking appropriate first steps.
- Ignoring constraints or tradeoffs.

Feedforward indicators:

- What kind of scenario demand is likely for the role.
- A reminder to reason out loud and explain priorities.

Feedback indicators:

- Whether the decision path was clear.
- Whether the answer addressed the tradeoff.
- Whether role judgment was visible.

Dashboard use:

- Scenario appears as a question-category row.
- It is the clearest category for evaluating decision rationale and role judgment.
- Scenario category coaching should not require a past example unless the question explicitly asks for one.

### Technical / Role-Specific

Candidate-facing definition:

> Technical or role-specific questions ask about the knowledge, tools, processes, or judgment needed for the role.

Interviewer objective:

- Assess practical role understanding.
- Check familiarity with tools, workflows, regulations, methods, or domain concepts.
- Understand how the candidate applies role knowledge in context.

What the question asks the candidate to do:

- Explain relevant knowledge clearly.
- Use role-specific terms accurately without overcomplicating.
- Connect knowledge to practical work.
- Admit limits professionally when needed and explain how they would learn or verify.

Resume/JD use:

- JD should drive tools, requirements, workflows, and domain topics.
- Resume content can identify likely strengths or transfer points.
- Feedback can encourage the candidate to connect existing experience to role-specific requirements.

Coach evidence:

- Does the answer show role-relevant knowledge?
- Does it use accurate terms or process steps?
- Does it explain practical application?
- Does it avoid unsupported claims?

Common weak patterns:

- Vague claims of familiarity.
- Overly technical answer that does not answer the question.
- No role-specific detail.
- Unsupported tool/process claims.

Feedforward indicators:

- Which role-specific areas may be worth practicing.
- Whether the planned round includes technical/role-specific questions.
- Guidance to connect knowledge to practical examples.

Feedback indicators:

- Whether the answer demonstrated practical role understanding.
- Whether the candidate connected knowledge to the job context.
- Whether the answer was clear enough for the expected interview stage.

Dashboard use:

- Technical / Role-Specific appears as a question-category row.
- It should be included only when relevant to role/JD/stage/question count.
- Category feedback should distinguish role knowledge from communication quality.

## Category And Lane Crosswalk

The dashboard matrix crosses categories with lanes:

| Cross-section | Candidate meaning |
| --- | --- |
| Category x Substance | Did the answer meet the content demand of this type of question? |
| Category x Structure | Was the answer organized in a way that fits this type of question? |
| Category x Delivery | Was the answer communicated clearly for this type of question? |

This crosswalk should not create new raw scores. It should reuse existing answer-evaluation scores and candidate-safe evidence copy.

## Prompting Implications

Question generation should use categories differently:

- Behavioral: invite real prior examples.
- Scenario: present imagined realistic situations.
- Culture / Fit: ask motivation, values, work style, and fit questions without turning them into hiring judgments.
- Screening: ask basic interest, background, qualification, availability, or logistics questions.
- Technical / Role-Specific: ask role/JD-specific knowledge or process questions.

Answer feedback should preserve the category distinction:

- Do not criticize a Scenario answer for lacking a past event unless the question asked for one.
- Do not treat a Behavioral answer as complete if it gives only a hypothetical response.
- Do not overstate Culture / Fit as a hiring-fit assessment.
- Do not treat Screening as a deep technical interview unless the prompt requires it.

## Visualization Implications

Recommended visual roles:

- Question plan / category coverage: segmented or radial coverage visual.
- Performance lanes and dimensions: node-link or hierarchy visual.
- Matrix: evidence-backed detail layer crossing category demand with performance lane.

Color should answer "how well." Fill, arc length, opacity, or completion should answer "how much evidence or coverage."

The instant-read side of the dashboard may combine:

- a simple answer-quality node cluster for Substance, Structure, and Delivery;
- a quiet category coverage ring or segment treatment for question plan scope;
- a static guidance card that updates after each completed practice round but does not compete with modal drilldowns.

The matrix/detail side should continue to support row, column, and cell drilldowns.

## Open Questions

- When should the candidate see snapshot state versus current accumulated state?
- Should Scenario remain the candidate-facing label, with Case/Scenario as internal or recruiter-facing terminology?
- Which category definitions should appear in generation-to-session carousel content?
- How much category explanation belongs on session landing versus dashboard?
- How should category-specific next practice recommendations be generated once cross-session pattern detection lands?
