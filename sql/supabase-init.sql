-- 在 Supabase Dashboard → SQL Editor 中粘贴执行

-- tasks：寻宝任务
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  keyword text not null,
  hint text,
  created_at timestamptz not null default now()
);

-- scores：判定为 match 时的得分记录
create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks (id) on delete set null,
  keyword text not null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists scores_task_id_idx on public.scores (task_id);
create index if not exists scores_created_at_idx on public.scores (created_at desc);

grant usage on schema public to anon;
grant select on table public.tasks to anon;
grant select, insert on table public.scores to anon;

alter table public.tasks enable row level security;
alter table public.scores enable row level security;

-- 使用 anon key 时，允许匿名读取任务、写入得分（生产环境请按需收紧）
drop policy if exists "tasks_select_anon" on public.tasks;
create policy "tasks_select_anon"
  on public.tasks for select
  to anon
  using (true);

drop policy if exists "scores_insert_anon" on public.scores;
create policy "scores_insert_anon"
  on public.scores for insert
  to anon
  with check (true);

drop policy if exists "scores_select_anon" on public.scores;
create policy "scores_select_anon"
  on public.scores for select
  to anon
  using (true);

-- 示例数据（可选）
insert into public.tasks (title, keyword, hint)
values
  ('城市寻宝', '红色邮筒', '找找街角有没有经典红漆'),
  ('自然观察', '一片银杏叶', '秋天金黄色扇形叶子'),
  ('美食任务', '一杯拉花咖啡', '奶泡上要有图案才算');
