-- generated from supabase/seeds/universities.csv
-- source of truth: universities.csv

insert into public.universities (name)
select source.name
from (
  values
    ('専修大学'),
    ('明治大学'),
    ('早稲田大学'),
    ('慶應義塾大学'),
    ('東京大学'),
    ('京都大学'),
    ('大阪大学'),
    ('北海道大学'),
    ('東北大学'),
    ('名古屋大学'),
    ('九州大学'),
    ('神戸大学'),
    ('筑波大学'),
    ('横浜国立大学'),
    ('千葉大学'),
    ('広島大学'),
    ('岡山大学'),
    ('立命館大学'),
    ('同志社大学'),
    ('関西大学'),
    ('関西学院大学'),
    ('法政大学'),
    ('中央大学'),
    ('日本大学'),
    ('青山学院大学'),
    ('立教大学')
) as source(name)
on conflict (name) do update
set name = excluded.name;
