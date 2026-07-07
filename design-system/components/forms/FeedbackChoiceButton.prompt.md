Selectable choice button used in surveys and confidence checks. `kind="emoji"` renders the 5-point emoji scale squares; `chip`/`compact` are text options.

```jsx
{EMOJI_SCALE.map(({ val, emoji }) => (
  <FeedbackChoiceButton key={val} kind="emoji" selected={rating === val} onClick={() => setRating(val)}>{emoji}</FeedbackChoiceButton>
))}
<FeedbackChoiceButton kind="chip" tone="success" selected>Yes, ready</FeedbackChoiceButton>
```
