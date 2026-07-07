Transient success pill — pops above the trigger (parent needs `position: relative`).

```jsx
<div style={{ position: "relative" }}>
  <Button onClick={copy}>Copy link</Button>
  <FeedbackPill isVisible={copied} text="Copied" />
</div>
```
