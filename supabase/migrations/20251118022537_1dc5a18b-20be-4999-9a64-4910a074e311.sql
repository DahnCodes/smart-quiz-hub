-- Create app_role enum for roles
CREATE TYPE public.app_role AS ENUM ('admin', 'student');

-- Create user_roles table (security requirement - roles must be separate)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Add class field to profiles (for students)
ALTER TABLE public.profiles ADD COLUMN class TEXT;

-- Add class field to quizzes (to assign quizzes to specific classes)
ALTER TABLE public.quizzes ADD COLUMN class TEXT;

-- Update profiles trigger to handle role assignment to user_roles table
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, full_name, role, class)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'student'),
    NEW.raw_user_meta_data->>'class'
  );
  
  -- Insert into user_roles table
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'student')
  );
  
  RETURN NEW;
END;
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- Update quiz RLS policies to use has_role function
DROP POLICY IF EXISTS "Admins can create quizzes" ON public.quizzes;
DROP POLICY IF EXISTS "Admins can update their own quizzes" ON public.quizzes;
DROP POLICY IF EXISTS "Admins can delete their own quizzes" ON public.quizzes;

CREATE POLICY "Admins can create quizzes"
ON public.quizzes
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update their own quizzes"
ON public.quizzes
FOR UPDATE
USING (
  created_by = auth.uid() 
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can delete their own quizzes"
ON public.quizzes
FOR DELETE
USING (
  created_by = auth.uid() 
  AND public.has_role(auth.uid(), 'admin')
);

-- Update questions RLS to use has_role
DROP POLICY IF EXISTS "Admins can manage questions for their quizzes" ON public.questions;

CREATE POLICY "Admins can manage questions for their quizzes"
ON public.questions
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM quizzes q
    WHERE q.id = questions.quiz_id
      AND q.created_by = auth.uid()
      AND public.has_role(auth.uid(), 'admin')
  )
);

-- Students can only see quizzes for their class
DROP POLICY IF EXISTS "Anyone can view active quizzes" ON public.quizzes;

CREATE POLICY "Students can view quizzes for their class"
ON public.quizzes
FOR SELECT
USING (
  is_active = true 
  AND (
    class = (SELECT class FROM profiles WHERE id = auth.uid())
    OR created_by = auth.uid()
  )
);