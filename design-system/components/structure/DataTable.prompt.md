Bordered data table — uppercase micro headers, subtle-fill head row, hover-tinted body rows.

```jsx
<DataTable columns={[{key:"name",label:"Candidate"},{key:"status",label:"Status"}]} rows={rows}
  renderCell={(r,c) => c.key==="status" ? <StatusBadge variant="success">{r.status}</StatusBadge> : r[c.key]} />
```
