---
name: ste-explain
description: Write explanations in ASD-STE100 Simplified Technical English at 80% strictness (core rules enforced, the STE dictionary relaxed). Use whenever the user asks to explain, describe or clarify something, in any language - "explica", "me explica", "explica de forma simples", "o que é", "por que falhou", "como funciona", "o que o X fez", "explain", "what does X do", "why did X fail". Also use when the user says "usa STE", "ASD-STE100" or "Simplified Technical English".
---

# STE explanations (ASD-STE100 at 80%)

Use this style for the explanation itself. Code, commands, identifiers, file paths and exact error text stay as they are.

Write in the user's language. The STE rules apply to Portuguese as well as English. In Portuguese, keep articles and normal grammar.

This style replaces terse or caveman compression for the explanation body. Write full sentences, but keep them short.

## What 80% means

**Enforce these rules (the 80%):**

1. **One idea per sentence.** Split a sentence that holds two ideas.
2. **Short sentences.** Use 20 words or fewer for instructions, and 25 or fewer for descriptions.
3. **Active voice.** Write "The service logs the error", not "The error is logged".
4. **Present tense, where it is true.** Use the past tense only for events that already happened, such as a test run or a commit.
5. **One word, one meaning.** Pick one term for each thing and use it every time. If you say "envelope", do not later say "payload" or "request body" for the same thing.
6. **Short noun clusters.** Use 3 nouns or fewer in a row. Write "the score of the owner", not "owner credit score reason code list".
7. **Short paragraphs.** Use 6 sentences or fewer, about one topic.
8. **Imperative for instructions.** Write "Run the test", not "The test should be run".
9. **One instruction per sentence.** Put a sequence of steps in a numbered list.
10. **No idioms, metaphors or slang.** Write "the call fails", not "the call blows up".
11. **No vague words.** Do not use "basically", "kind of", "some issues" or "etc.". Name the thing.
12. **Define a term on first use** when the reader may not know it. Use one short clause, such as "B505 (the LexisNexis business-owner score)".

**Relax these rules (the 20%):**

- **Words:** you do not have to use the STE approved dictionary. Use the project's technical words, product names and domain terms freely.
- **Sentence length:** a sentence can be longer than the limit when an exact name, path or quoted error makes it long. It can also be longer when splitting it would hide the cause and the effect.
- **Formatting:** use tables, bullet lists, code blocks and bold labels when they make the text clearer.
- **Opinions:** you may give a recommendation or verdict, but say clearly that it is a recommendation.

## Structure of an explanation

1. **Short answer first.** Give the answer in 1 or 2 sentences. If the user asked a yes/no or A/B question, answer it here.
2. **Sections by question.** Order them by what the reader needs, for example "What it does", "What went wrong", "What changed" and "What is still open". Use only the sections that apply.
3. **Evidence.** Give facts that the reader can check: IDs, numbers, file:line references and test results. Do not put raw log dumps in the text. Quote only the decisive line.
4. **Next step**, if there is one. Write it as one imperative sentence or one question to the user.

## Check before you send

- Does each sentence hold one idea?
- Is any sentence longer than 25 words without a good reason?
- Do you use the same term for the same thing everywhere?
- Is there passive voice that you can make active?
- Does the first paragraph answer the question?
