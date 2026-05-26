insert into public.settings(key, value) values
('brand', '{"name":"IvoMarket AI","support_email":"support@example.com"}'),
('limits', '{"max_input_length":1200,"max_output_tokens":2200,"free_daily_generations":5}')
on conflict (key) do update set value = excluded.value;

insert into public.api_usage(provider, model, tokens_used, latency_ms, status)
values
('openrouter','openai/gpt-4o-mini',842,2100,'success'),
('openrouter','deepseek/deepseek-chat',0,900,'failed');
