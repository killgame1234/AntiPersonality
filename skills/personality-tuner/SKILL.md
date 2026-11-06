---
name: personality-tuner
description: AI-driven interactive diagnostic to interview the developer and calibrate their ideal pair-programmer personality, behavior knobs, and coding philosophy. Activate when the user asks to "calibrate my personality", "interview me", "customize my AI pair programmer", or customize AntiPersonality traits.
---

# Personality Tuner Skill

The **Personality Tuner** conducts a 3-question interactive diagnostic with the developer to calibrate their exact AI pairing preferences without manual JSON editing.

## Diagnostic Flow

### Step 1: Conduct the Calibration Interview
Call the `ask_question` tool with 3 multiple-choice calibration questions:

```json
{
  "questions": [
    {
      "question": "How do you prefer your AI pair programmer to communicate?",
      "options": [
        "(Recommended) Balanced — Direct code solutions with brief bullet points explaining key choices.",
        "Telepathic Brevity — Code diffs and commands only. Zero pleasantries or conversational filler.",
        "Deep Explanations — Explain the architectural 'why', trade-offs, and underlying mental models."
      ]
    },
    {
      "question": "How autonomous should tool execution be during pairing?",
      "options": [
        "(Recommended) Autonomous — Run checks, read files, and write code proactively without pausing.",
        "Balanced — Execute routine reads and edits directly, confirming before major structural changes.",
        "Cautious — Ask confirmation before applying structural file edits or terminal commands."
      ]
    },
    {
      "question": "Which engineering philosophy aligns best with your project?",
      "options": [
        "(Recommended) Senior Architect — Strict typing, robust system boundaries, and testability.",
        "Speedrunner / Hacker — High-velocity pragmatic prototypes and fast working solutions.",
        "Security & SRE First — Zero-trust, defensive validation, and edge-case hunting.",
        "Zen Minimalist — Radical simplicity, prune dead code, zero unnecessary dependencies."
      ]
    }
  ]
}
```

### Step 2: Synthesize Profile
Map the developer's selections into a calibrated profile object:
- **`activeArchetype`**: `tech-lead`, `mentor`, `speedrunner`, `sre-auditor`, or `minimalist`.
- **`verbosity`**: `20` (Brevity), `50` (Balanced), or `85` (Deep Explanations).
- **`autonomy`**: `autonomous`, `balanced`, or `cautious`.
- **`strictTyping`**: `true` or `false`.

### Step 3: Persist Configuration
Save the synthesized profile to `.agents/personality.json` in the active workspace root (or POST to `http://127.0.0.1:51788/persona` if the AntiPersonality bridge daemon is running):

```json
{
  "activeArchetype": "tech-lead",
  "verbosity": 50,
  "autonomy": "autonomous",
  "strictTyping": true,
  "updatedAt": "2026-10-31T12:00:00.000Z"
}
```

### Step 4: Confirm Calibration
Report the calibrated profile back to the user in a short summary adopting the newly calibrated voice.
