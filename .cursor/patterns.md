# Vantera Code Patterns

## Server Action

```ts
export async function actionName(input: InputType): Promise<ActionResult<OutputType>> {
  const session = await requireAdminSession()
  const validated = schema.parse(input)
  const result = await db.query...where(eq(table.accountId, session.accountId))
  return { success: true, data: result }
}
```

## Query Shape

```ts
const result = await db.query.tableName.findMany({
  where: and(eq(tableName.accountId, accountId), isNull(tableName.deletedAt)),
  orderBy: desc(tableName.createdAt),
})
```

## Soft Delete

```ts
await db.update(tableName)
  .set({ deletedAt: new Date() })
  .where(and(eq(tableName.id, id), eq(tableName.accountId, session.accountId)))
```

## API Response Shape

```ts
{ success: true, data: T }
{ success: false, error: string, code?: string }
```
