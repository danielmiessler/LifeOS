# Perform Interview Research

You are preparing research for a sponsored interview at an information security or tech startup. Your goal is to generate Tyler Cowen-style questions based on Claude Shannon's concept of surprise - questions and answers should maximize information content and never be boring.

## Research Protocol

Use the /conduct-research command to investigate the following about **{company_name}**:

1. **Recent Activity & Announcements** (last 6 months)
   - Product launches and updates
   - Funding rounds or business milestones
   - Press releases and media coverage
   - Conference talks or presentations

2. **Technical Innovation**
   - Core technology and approach
   - Patents or research papers
   - Technical blog posts
   - Open source contributions

3. **Social Media & Thought Leadership**
   - CEO/founder social media activity
   - Company blog posts
   - Podcast appearances
   - Industry commentary and opinions

4. **Competitive Landscape**
   - Direct competitors and alternatives
   - Market positioning
   - Unique differentiators
   - Industry trends they're responding to

5. **Future Direction**
   - Roadmap hints or statements
   - Job postings (what roles they're hiring)
   - Strategic partnerships
   - Market expansion signals

## Output Format

After research, provide:

### COMPANY SUMMARY (2-3 paragraphs)
- What they're building and why it matters
- Recent momentum and achievements
- What they seem most excited about
- Key differentiators from competition

### INTERVIEW QUESTIONS (10 total)

Generate 10 questions that:
- Maximize surprise and information content (Shannon principle)
- Use Tyler Cowen's style: unexpected angles, implicit assumptions challenged, "production function" thinking
- Avoid obvious or boring questions
- Elicit stories, not just facts
- Reveal mental models and decision-making processes

**Required question themes** (reframed in novel ways):
1. Problem definition and origin story
2. Competitive differentiation and strategy
3. Future vision and industry evolution

**Additional themes to explore**:
- Counter-intuitive insights they've discovered
- Failed experiments and pivots
- Hiring philosophy and team building
- Customer surprises or unexpected use cases
- Technical trade-offs and architecture decisions
- Market timing and "why now"
- Contrarian beliefs about their industry

### Question Format:
For each question, provide:
- **Q[number]:** The actual question
- **Why:** Brief explanation of what surprising insight this might reveal
- **Follow-up angle:** One potential follow-up based on likely answers

## Tyler Cowen Question Principles

Apply these techniques:
- **Oblique approach**: Ask about adjacent topics to reveal core insights
- **Production function**: "What inputs create your outputs?"
- **Marginal thinking**: "What's the next bottleneck?"
- **Status quo challenge**: "What does everyone else get wrong?"
- **Personal history**: "What experience shaped this decision?"
- **Taste and aesthetics**: "What do you find beautiful about your solution?"
- **Edge cases**: "When does your approach fail?"
- **Second-order effects**: "What happens when you succeed?"

## Shannon Surprise Principle

Maximize information entropy by:
- Avoiding questions with predictable answers
- Seeking insights that contradict conventional wisdom
- Finding the "least likely but most important" aspects
- Revealing hidden complexity in apparently simple systems
- Exposing assumptions that aren't being questioned

## Example Question Transformations

❌ **Boring**: "What problem are you solving?"
✅ **Interesting**: "What problem did you initially *think* you were solving, and when did you realize you were actually solving something completely different?"

❌ **Boring**: "How are you different from competitors?"
✅ **Interesting**: "If your top competitor called you for advice on what they should build next, what would you tell them - and what would you deliberately leave out?"

❌ **Boring**: "What's your vision for the future?"
✅ **Interesting**: "If you woke up in 2030 and your company had failed, what would be the most likely reason - and what could make that failure look obvious in retrospect?"

## Research Command

Now execute: `/conduct-research {company_name} - focus on: recent announcements, technical innovation, competitive positioning, founder/executive social media, future direction signals, and any contrarian or surprising aspects of their approach`
