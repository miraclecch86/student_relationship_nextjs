-- Create tables for the student relationship management system

-- Create classes table
create table classes (
    id bigint primary key generated always as identity,
    name varchar(100) not null,
    description text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create students table
create table students (
    id bigint primary key generated always as identity,
    name varchar(100) not null,
    class_id bigint references classes(id) on delete cascade not null,
    weekly_form_data jsonb default '{}',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create relationships table
create table relationships (
    id bigint primary key generated always as identity,
    student_id bigint references students(id) on delete cascade not null,
    friend_id bigint references students(id) on delete cascade not null,
    relationship_type varchar(20) not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    constraint unique_relationship unique (student_id, friend_id)
);

-- Create indexes
create index idx_students_class_id on students(class_id);
create index idx_relationships_student_id on relationships(student_id);
create index idx_relationships_friend_id on relationships(friend_id);

-- Enable Row Level Security
alter table classes enable row level security;
alter table students enable row level security;
alter table relationships enable row level security;

-- Create policies for anonymous access
create policy "Enable all access for all users" on classes
    for all
    using (true)
    with check (true);

create policy "Enable all access for all users" on students
    for all
    using (true)
    with check (true);

create policy "Enable all access for all users" on relationships
    for all
    using (true)
    with check (true);

-- Create functions
create or replace function get_class_relationships(p_class_id bigint)
returns table (
    student_id bigint,
    friend_id bigint,
    relationship_type varchar(20)
)
language sql
security definer
as $$
    select r.student_id, r.friend_id, r.relationship_type
    from relationships r
    join students s1 on r.student_id = s1.id
    join students s2 on r.friend_id = s2.id
    where s1.class_id = p_class_id and s2.class_id = p_class_id;
$$; 