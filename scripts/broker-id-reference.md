# broker_id vs id - Database Reference Guide

## The "brokers" Table

The **brokers** table is the parent table for all user data. It uses:
- Primary Key: `id` (UUID)
- NOT `broker_id`

```sql
CREATE TABLE brokers (
  id UUID PRIMARY KEY,  -- ← This is the primary key
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  is_manager BOOLEAN DEFAULT false,
  is_admin BOOLEAN DEFAULT false,
  office_location TEXT,
  ...
);
```

## How broker_id is Used

All child tables reference the `brokers.id` column using a **foreign key** named `broker_id`:

### Tables Using broker_id Foreign Key:

1. **customers** table
   ```sql
   broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE
   ```

2. **tasks** table
   ```sql
   broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE
   ```

3. **contact_log** table
   ```sql
   broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE
   ```

4. **notifications** table
   ```sql
   broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE
   ```

5. **user_preferences** table
   ```sql
   broker_id UUID UNIQUE NOT NULL REFERENCES brokers(id) ON DELETE CASCADE
   ```

6. **email_templates** table
   ```sql
   broker_id UUID REFERENCES brokers(id) ON DELETE CASCADE
   ```

7. **task_templates** table
   ```sql
   broker_id uuid REFERENCES brokers(id) ON DELETE CASCADE
   ```

8. **custom_statuses** table
   ```sql
   broker_id UUID REFERENCES brokers(id) ON DELETE CASCADE
   ```

9. **tms_links** table
   ```sql
   broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE
   ```

## Why This Naming Convention?

This is a standard database pattern:
- **Parent table**: Uses `id` as primary key
- **Child tables**: Use `[parent_table_singular]_id` as foreign key

So `broker_id` in child tables → references `brokers.id`

## In Code (TypeScript)

When querying:
```typescript
// Get broker's customers
const { data } = await supabase
  .from('customers')
  .select('*')
  .eq('broker_id', userId);  // ← broker_id is the FK column in customers table
```

When the current user's ID is stored in a variable, it's often called `brokerId`:
```typescript
const [brokerId, setBrokerId] = useState<string>('');
// This variable holds the value from brokers.id
```

## Common Confusion Points

❌ **WRONG**: Looking for `brokers.broker_id` (doesn't exist)
✅ **CORRECT**: `brokers.id` is the primary key

❌ **WRONG**: `customers.id` references `brokers.id`
✅ **CORRECT**: `customers.broker_id` references `brokers.id`

## Row-Level Security (RLS)

RLS policies use `broker_id` to filter data:
```sql
CREATE POLICY "Brokers see only their customers"
  ON customers
  FOR SELECT
  USING (broker_id = auth.uid());
```

This checks if the customer's `broker_id` matches the authenticated user's `auth.uid()` (which equals `brokers.id`).
