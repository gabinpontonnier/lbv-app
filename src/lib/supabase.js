import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://cnwgeihzvluqztgmafhw.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_IgEhGL9gTr9F-gUEKFkqMA_y7asKnxb'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
