[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/inspection](../README.md) / InspectionRound

# Interface: InspectionRound

## Properties

### answers

> **answers**: [`InspectionAnswer`](InspectionAnswer.md)[]

***

### awaitingNext

> **awaitingNext**: `boolean`

True after an answer, until the player moves on.

***

### current

> **current**: `number`

Index of the question being asked; equals `questions.length` when done.

***

### questions

> **questions**: [`InspectionQuestion`](InspectionQuestion.md)[]

***

### timeRemaining

> **timeRemaining**: `number`

Seconds left on the current question.

***

### timerEnabled

> **timerEnabled**: `boolean`

False when the player turned the timer off (WCAG 2.2.1).
