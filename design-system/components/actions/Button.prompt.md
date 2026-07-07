Shared button system — use for in-app actions on both dialects; hovers raise shadow one tier and darken 10%, press scales to 0.98.

```jsx
<Button>Save changes</Button>
<Button variant="outline">Cancel</Button>
<Button emphasis="primary" density="hero" shape="pill" label="strong">Start Practice</Button>
```

Two axes: classic `variant`/`size` (default, destructive, outline, secondary, ghost, link, info × default/sm/lg/icon) or the system axes `emphasis`/`density`/`shape`/`label`.
