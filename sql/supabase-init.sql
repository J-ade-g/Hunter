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

-- 新增字段（已有数据库执行此段即可；全新建库可忽略，建表语句已含这些字段）
alter table public.scores add column if not exists player_name text;
alter table public.scores add column if not exists points int not null default 0;

-- 任务数据
insert into public.tasks (title, keyword, hint)
values
  ('今日任务', '享福', '拍下让你感到舒适、满足的瞬间'),
  ('今日任务', '牛马', '打工人的疲惫或机械感'),
  ('今日任务', '哭了', '不一定真哭，拍出那种崩溃感'),
  ('今日任务', '滚开', '表达强烈的拒绝或排斥'),
  ('今日任务', '屁股', '字面或抽象都行，越大胆越好'),
  ('今日任务', '红色', '用红色主导整张照片'),
  ('今日任务', '发疯', '失控、崩溃、抽象的状态'),
  ('今日任务', '躺平', '越字面越好，躺就完了'),
  ('今日任务', '班味', '散发出上班气息的任何东西'),
  ('今日任务', '松弛感', '不用力、不紧绷的状态'),
  ('今日任务', '内耗', '拍出那种自我消耗的感觉'),
  ('今日任务', '搭子', '陪你做某件事的人或物'),
  ('今日任务', '多巴胺', '让你瞬间快乐的颜色或事物'),
  ('今日任务', '嘴替', '拍下你想说但没说出口的东西'),
  ('今日任务', '整顿', '有秩序感、被收拾过的场景'),
  ('今日任务', '破防', '某个让你绷不住的瞬间'),
  ('今日任务', '摆烂', '放弃挣扎的状态'),
  ('今日任务', '拿捏', '掌控感十足的姿态'),
  ('今日任务', '绷不住', '快要笑出来或崩溃的临界点'),
  ('今日任务', '显眼包', '最抢眼、最突出的那个'),
  ('今日任务', '抽象', '越看不懂越好'),
  ('今日任务', '氛围感', '说不清但感觉对了'),
  ('今日任务', '钝感', '迟钝、不敏感、慢半拍的感觉'),
  ('今日任务', '精神状态', '拍出你此刻的精神面貌'),
  ('今日任务', '社恐', '想躲开人群的瞬间'),
  ('今日任务', '废物', '没用但可爱的东西'),
  ('今日任务', '上头', '沉迷、停不下来的状态'),
  ('今日任务', '清醒', '冷静、通透、看穿一切的感觉'),
  ('今日任务', '孤独', '一个人的安静瞬间'),
  ('今日任务', '野性', '原始、不受约束的感觉'),
  ('今日任务', '油腻', '过度、用力过猛的状态'),
  ('今日任务', '整活', '搞怪、出乎意料的创意'),
  ('今日任务', '沉默', '无声胜有声的瞬间'),
  ('今日任务', '暴富', '拍出有钱或想有钱的感觉'),
  ('今日任务', '佛系', '随缘、无所谓的状态'),
  ('今日任务', '卷', '努力到极致或内卷的场景'),
  ('今日任务', '躁', '烦躁、坐立不安的感觉'),
  ('今日任务', '甜', '让人心软的温柔瞬间'),
  ('今日任务', '丑', '审美意义上的丑，但要有态度'),
  ('今日任务', '空', '空旷、虚无、留白'),
  ('今日任务', '重', '视觉上或情绪上的沉重感'),
  ('今日任务', '软', '柔软、无力、懒散的质感'),
  ('今日任务', '硬', '坚硬、强硬、不妥协的感觉'),
  ('今日任务', '脏', '有质感的凌乱，不是真脏'),
  ('今日任务', '燃', '热血、激情、点燃的瞬间'),
  ('今日任务', '冷', '冷漠、疏离或低温感'),
  ('今日任务', '满', '塞满、过载、喘不过气'),
  ('今日任务', '碎', '破碎感，物理或情绪都行'),
  ('今日任务', '飘', '失重、游离、不踏实的状态'),
  ('今日任务', '稳', '沉稳、踏实、不慌不忙');
