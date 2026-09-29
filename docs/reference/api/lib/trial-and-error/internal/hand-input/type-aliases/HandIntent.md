[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/hand-input](../README.md) / HandIntent

# Type Alias: HandIntent

> **HandIntent** = \{ `kind`: `"BLOCKED"`; \} \| \{ `index`: `number`; `kind`: `"FOCUS"`; \} \| \{ `focusIndex`: `number`; `kind`: `"MOVE"`; `toIndex`: `number`; \} \| \{ `kind`: `"TOGGLE_SELECT"`; \} \| \{ `kind`: `"PLAY"`; \} \| \{ `kind`: `"DISCARD"`; \} \| \{ `kind`: `"INSPECT"`; \} \| \{ `kind`: `"RECOMPILE"`; \} \| \{ `kind`: `"STRUCTURAL_QC"`; \} \| \{ `kind`: `"FOCUS_ALLOCATE"`; \} \| \{ `kind`: `"READ"`; \} \| \{ `kind`: `"APPLY_SEAL"`; \} \| \{ `kind`: `"PUT_SEAL_BACK"`; \}

What an input on a card in hand asks for.

## Union Members

### Type Literal

\{ `kind`: `"BLOCKED"`; \}

Consume the input and do nothing, e.g. a reorder during playback.

***

### Type Literal

\{ `index`: `number`; `kind`: `"FOCUS"`; \}

Move the roving focus to another card.

***

### Type Literal

\{ `focusIndex`: `number`; `kind`: `"MOVE"`; `toIndex`: `number`; \}

Move this card to `toIndex`; focus follows it to `focusIndex`.

***

### Type Literal

\{ `kind`: `"TOGGLE_SELECT"`; \}

***

### Type Literal

\{ `kind`: `"PLAY"`; \}

***

### Type Literal

\{ `kind`: `"DISCARD"`; \}

***

### Type Literal

\{ `kind`: `"INSPECT"`; \}

***

### Type Literal

\{ `kind`: `"RECOMPILE"`; \}

***

### Type Literal

\{ `kind`: `"STRUCTURAL_QC"`; \}

***

### Type Literal

\{ `kind`: `"FOCUS_ALLOCATE"`; \}

Hand focus to the allocation control for this blank shell.

***

### Type Literal

\{ `kind`: `"READ"`; \}

Open the card's detail view.

***

### Type Literal

\{ `kind`: `"APPLY_SEAL"`; \}

Affix the picked-up footnote seal to this card.

***

### Type Literal

\{ `kind`: `"PUT_SEAL_BACK"`; \}

Put the picked-up footnote seal back in the tray.
