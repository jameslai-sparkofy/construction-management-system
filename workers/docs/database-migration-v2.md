# Database Migration V2 Documentation

## Migration Date: 2025-08-17

### Tables Deleted
- `project_members` 
- `project_owners`
- `project_permissions`
- `users`

### New Tables Created

#### 1. teams
```sql
CREATE TABLE teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    site_count INTEGER DEFAULT 0,
    member_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### 2. members
```sql
CREATE TABLE members (
    user_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT UNIQUE,
    abbreviation TEXT,
    source_type TEXT NOT NULL, -- 'crm_worker', 'crm_admin', 'manual'
    source_id TEXT,
    password_suffix TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### 3. team_memberships
```sql
CREATE TABLE team_memberships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id TEXT NOT NULL,
    member_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'team_member', -- 'team_leader' or 'team_member'
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES members(user_id) ON DELETE CASCADE,
    UNIQUE(team_id, member_id)
);
```

#### 4. project_teams
```sql
CREATE TABLE project_teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,
    team_id TEXT NOT NULL,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    UNIQUE(project_id, team_id)
);
```

#### 5. project_admins
```sql
CREATE TABLE project_admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,
    admin_id TEXT NOT NULL,
    role TEXT DEFAULT 'admin',
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES members(user_id) ON DELETE CASCADE,
    UNIQUE(project_id, admin_id)
);
```

## API Changes

### New API Version: api-v2.js
- Updated all endpoints to use new table structure
- Maintains backward compatibility with frontend
- Key changes:
  - `/api/v1/projects/{id}/users/add` - Now uses members, teams, team_memberships tables
  - `/api/v1/projects/{id}/users` - Returns data from new structure
  - `/api/v1/projects/{id}/users/{id}` DELETE - Removes from project_admins or team_memberships

### Data Flow
1. **Adding Workers**:
   - Creates member record if not exists
   - Creates team record if not exists  
   - Adds to team_memberships
   - Links team to project via project_teams

2. **Adding Admins**:
   - Creates member record if not exists
   - Links to project via project_admins

3. **Querying Project Users**:
   - Joins project_teams -> teams -> team_memberships -> members for workers
   - Joins project_admins -> members for admins

## Migration Status
- ✅ Old tables deleted
- ✅ New tables created
- ✅ API updated (api-v2.js)
- ⏳ Awaiting deployment (need new API token)
- ⏳ Frontend testing pending

## Next Steps
1. Get new Cloudflare API token
2. Deploy api-v2.js
3. Test all CRUD operations
4. Update frontend if needed