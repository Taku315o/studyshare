update public.courses
set name = btrim(
  regexp_replace(
    replace(
      replace(
        replace(
          replace(
            replace(coalesce(name, ''), '&nbsp;', ' '),
            '&#160;',
            ' '
          ),
          '&#xA0;',
          ' '
        ),
        '&amp;',
        '&'
      ),
      '&quot;',
      '"'
    ),
    '\s+',
    ' ',
    'g'
  )
)
where name ~* '(&nbsp;|&#160;|&#xA0;|&amp;|&quot;)';

update public.course_offerings
set instructor = nullif(
  btrim(
    regexp_replace(
      replace(
        replace(
          replace(
            replace(
              replace(coalesce(instructor, ''), '&nbsp;', ' '),
              '&#160;',
              ' '
            ),
            '&#xA0;',
            ' '
          ),
          '&amp;',
          '&'
        ),
        '&quot;',
        '"'
      ),
      '\s+',
      ' ',
      'g'
    )
  ),
  ''
)
where instructor ~* '(&nbsp;|&#160;|&#xA0;|&amp;|&quot;)';
