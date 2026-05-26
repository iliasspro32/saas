create extension if not exists "pgcrypto";

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'user' check (role in ('user','admin')),
  plan text not null default 'free' check (plan in ('free','starter','pro','agency')),
  banned boolean not null default false,
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.plans (
  key text primary key,
  name text not null,
  monthly_credits int not null,
  stripe_price_id text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.credits (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  remaining int not null default 15 check (remaining >= 0),
  lifetime_used int not null default 0,
  updated_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text not null default 'free',
  status text not null default 'inactive',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content_type text not null,
  provider text not null,
  model text not null,
  input jsonb not null,
  output text not null,
  tokens_used int not null default 0,
  created_at timestamptz not null default now()
);

create table public.ai_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  prompt text not null,
  category text not null default 'marketing',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.content_categories (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.ai_models (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  model text not null,
  label text not null,
  premium boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(provider, model)
);

create table public.api_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  provider text not null default 'openrouter',
  model text,
  tokens_used int not null default 0,
  latency_ms int,
  status text not null check (status in ('success','failed')),
  error_message text,
  created_at timestamptz not null default now()
);

create table public.admin_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  stripe_invoice_id text,
  stripe_customer_id text,
  amount int not null default 0,
  currency text not null default 'usd',
  status text not null,
  created_at timestamptz not null default now()
);

create table public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin' and banned = false);
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  insert into public.credits(user_id, remaining)
  values (new.id, 15)
  on conflict (user_id) do nothing;
  insert into public.subscriptions(user_id, plan, status)
  values (new.id, 'free', 'inactive')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.deduct_credit(p_user_id uuid, p_amount int)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.credits
  set remaining = remaining - p_amount, lifetime_used = lifetime_used + p_amount, updated_at = now()
  where user_id = p_user_id and remaining >= p_amount;
  if not found then raise exception 'Insufficient credits'; end if;
end;
$$;

create or replace function public.grant_credits(p_user_id uuid, p_amount int)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.credits(user_id, remaining)
  values (p_user_id, p_amount)
  on conflict (user_id) do update set remaining = public.credits.remaining + excluded.remaining, updated_at = now();
end;
$$;

alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.credits enable row level security;
alter table public.subscriptions enable row level security;
alter table public.generations enable row level security;
alter table public.ai_templates enable row level security;
alter table public.ai_models enable row level security;
alter table public.content_categories enable row level security;
alter table public.api_usage enable row level security;
alter table public.admin_logs enable row level security;
alter table public.payments enable row level security;
alter table public.settings enable row level security;

create policy "profiles own read" on public.profiles for select using (auth.uid() = id or public.is_admin());
create policy "profiles own update" on public.profiles for update using (auth.uid() = id or public.is_admin()) with check (auth.uid() = id or public.is_admin());
create policy "plans readable" on public.plans for select using (active = true or public.is_admin());
create policy "plans admin" on public.plans for all using (public.is_admin()) with check (public.is_admin());
create policy "credits own read" on public.credits for select using (auth.uid() = user_id or public.is_admin());
create policy "credits admin" on public.credits for all using (public.is_admin()) with check (public.is_admin());
create policy "subscriptions own read" on public.subscriptions for select using (auth.uid() = user_id or public.is_admin());
create policy "subscriptions admin" on public.subscriptions for all using (public.is_admin()) with check (public.is_admin());
create policy "generations own" on public.generations for select using (auth.uid() = user_id or public.is_admin());
create policy "generations insert own" on public.generations for insert with check (auth.uid() = user_id or public.is_admin());
create policy "templates readable" on public.ai_templates for select using (active = true or public.is_admin());
create policy "templates admin" on public.ai_templates for all using (public.is_admin()) with check (public.is_admin());
create policy "models readable" on public.ai_models for select using (active = true or public.is_admin());
create policy "models admin" on public.ai_models for all using (public.is_admin()) with check (public.is_admin());
create policy "categories readable" on public.content_categories for select using (active = true or public.is_admin());
create policy "categories admin" on public.content_categories for all using (public.is_admin()) with check (public.is_admin());
create policy "usage own read" on public.api_usage for select using (auth.uid() = user_id or public.is_admin());
create policy "usage admin" on public.api_usage for all using (public.is_admin()) with check (public.is_admin());
create policy "admin logs admin" on public.admin_logs for all using (public.is_admin()) with check (public.is_admin());
create policy "payments own read" on public.payments for select using (auth.uid() = user_id or public.is_admin());
create policy "payments admin" on public.payments for all using (public.is_admin()) with check (public.is_admin());
create policy "settings admin" on public.settings for all using (public.is_admin()) with check (public.is_admin());

insert into public.plans(key, name, monthly_credits, stripe_price_id) values
('free','Free',15,null),
('starter','Starter',300,'price_starter'),
('pro','Pro',1200,'price_pro'),
('agency','Agency',4000,'price_agency')
on conflict (key) do nothing;

insert into public.ai_models(provider, model, label, premium) values
('openrouter','openai/gpt-4o-mini','GPT-4o Mini',false),
('openrouter','anthropic/claude-3.5-sonnet','Claude 3.5 Sonnet',true),
('openrouter','google/gemini-flash-1.5','Gemini Flash',false),
('openrouter','deepseek/deepseek-chat','DeepSeek Chat',false),
('openrouter','mistralai/mistral-large','Mistral Large',true)
on conflict (provider, model) do nothing;

insert into public.content_categories(key, label, description) values
('ads','Ads','Paid social and UGC ad assets'),
('short-form','Short-form video','TikTok, Reels, Shorts and faceless video scripts'),
('commerce','Commerce','Product descriptions and marketplace listings'),
('pages','Pages','Landing pages and sales pages'),
('products','Digital products','PLR, Canva packs, prompt packs and lead magnets'),
('seo','SEO','Blog outlines and search-driven content')
on conflict (key) do nothing;

insert into public.ai_templates(key, label, prompt, category) values
('viral_hooks','Viral Hooks','Create scroll-stopping viral hooks with pattern interrupts, curiosity gaps and specific audience pain points.','short-form'),
('facebook_ads','Facebook Ads','Write compliant direct-response Facebook ads with primary text, headline, description and CTA variations.','ads'),
('tiktok_hooks','TikTok Hooks','Generate short-form hooks that sound native to TikTok and open with a strong first three seconds.','short-form'),
('instagram_captions','Instagram Captions','Write captions with a strong opening line, value, soft CTA and hashtag ideas.','social'),
('reels_scripts','Reels Scripts','Create Reels scripts with scene beats, overlay text and delivery notes.','short-form'),
('youtube_shorts','YouTube Shorts','Create Shorts ideas with title, hook, script and retention device.','short-form'),
('product_descriptions','Product Descriptions','Write benefit-led product descriptions with objections handled and CTA.','commerce'),
('etsy_listings','Etsy Listings','Create Etsy SEO titles, tags and descriptions.','commerce'),
('email_campaigns','Email Campaigns','Write subject lines, preview text and campaign emails.','email'),
('landing_pages','Landing Pages','Write landing page hero, proof, features, FAQ and CTA sections.','pages'),
('sales_pages','Sales Pages','Create long-form sales page sections using ethical persuasion.','pages'),
('digital_product_ideas','Digital Product Ideas','Generate digital product ideas with buyer, promise, format and monetization angle.','products'),
('plr_product_ideas','PLR Product Ideas','Generate PLR product ideas with bundle contents and license positioning.','products'),
('canva_template_packs','Canva Template Packs','Design Canva template pack concepts with included pages and buyer.','products'),
('lead_magnets','Lead Magnets','Create lead magnet ideas with title, promise, outline and opt-in angle.','list-building'),
('webinar_titles','Webinar Titles','Generate webinar titles with promise, mechanism and audience specificity.','webinars'),
('offer_angles','Offer Angles','Create offer angles with positioning, urgency and objections addressed.','strategy'),
('ugc_ad_scripts','UGC Ad Scripts','Write UGC ad scripts with hook, problem, proof, offer and CTA.','ads'),
('seo_blog_outlines','SEO Blog Outlines','Create SEO blog outlines with intent, headings and meta description.','seo'),
('faceless_video_scripts','Faceless Video Scripts','Write faceless short video scripts with visuals, voiceover, captions and retention notes.','short-form'),
('ai_prompt_packs','AI Prompt Packs','Create themed AI prompt packs with prompt names, use cases and polished prompt text.','products')
on conflict (key) do nothing;
