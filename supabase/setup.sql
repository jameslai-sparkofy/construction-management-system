-- Supabase 初始化腳本
-- 這個腳本用來設定 Supabase 專案的資料庫結構

-- 啟用必要的擴充功能
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 建立用戶擴充資料表
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE,
    phone TEXT,
    full_name TEXT,
    company TEXT DEFAULT '元心建材',
    role TEXT DEFAULT 'worker',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 建立專案資料表（與 Cloudflare D1 對應）
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_name TEXT NOT NULL,
    site_number TEXT,
    phone TEXT,
    address TEXT,
    field_size DECIMAL(10,2),
    floor_plan_url TEXT,
    before_construction_url TEXT,
    after_construction_url TEXT,
    completion_date DATE,
    worker_name TEXT,
    area_completed DECIMAL(10,2),
    is_completed BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 建立工地格子資料表
CREATE TABLE IF NOT EXISTS project_grids (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    grid_number INTEGER NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, in_progress, completed
    completion_date DATE,
    worker_id UUID REFERENCES auth.users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, grid_number)
);

-- 建立照片資料表
CREATE TABLE IF NOT EXISTS project_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    grid_id UUID REFERENCES project_grids(id) ON DELETE CASCADE,
    photo_type TEXT NOT NULL, -- floor_plan, before, after, completion
    photo_url TEXT NOT NULL,
    uploaded_by UUID REFERENCES auth.users(id),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 建立活動記錄表
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 建立 RLS (Row Level Security) 政策
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_grids ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- 用戶資料政策
CREATE POLICY "Users can view their own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

-- 專案政策（所有登入用戶都可以查看和編輯）
CREATE POLICY "Authenticated users can view all projects" ON projects
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create projects" ON projects
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update projects" ON projects
    FOR UPDATE USING (auth.role() = 'authenticated');

-- 工地格子政策
CREATE POLICY "Authenticated users can view grids" ON project_grids
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage grids" ON project_grids
    FOR ALL USING (auth.role() = 'authenticated');

-- 照片政策
CREATE POLICY "Authenticated users can view photos" ON project_photos
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can upload photos" ON project_photos
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 活動記錄政策
CREATE POLICY "Users can view activity logs" ON activity_logs
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "System can create activity logs" ON activity_logs
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 建立觸發器：自動建立用戶資料
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, full_name)
    VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'full_name', new.email)
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 移除舊的觸發器（如果存在）
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 建立新的觸發器
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 建立更新時間觸發器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_grids_updated_at BEFORE UPDATE ON project_grids
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 建立索引以提升效能
CREATE INDEX idx_projects_created_by ON projects(created_by);
CREATE INDEX idx_project_grids_project_id ON project_grids(project_id);
CREATE INDEX idx_project_photos_project_id ON project_photos(project_id);
CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_project_id ON activity_logs(project_id);