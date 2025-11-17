-- Create enum for user roles
CREATE TYPE public.user_role AS ENUM ('student', 'admin');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'student',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create quizzes table
CREATE TABLE public.quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subject TEXT,
  description TEXT,
  duration_minutes INT NOT NULL,
  instructions TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  randomize_questions BOOLEAN NOT NULL DEFAULT true,
  randomize_options BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create questions table
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('mcq', 'true_false', 'short_answer')),
  options JSONB, -- Array of options for MCQ/True-False
  correct_answer TEXT NOT NULL,
  points INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create quiz attempts table
CREATE TABLE public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  score DECIMAL(5,2),
  total_points INT,
  time_taken_seconds INT,
  UNIQUE(quiz_id, student_id, started_at)
);

-- Create student answers table
CREATE TABLE public.student_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  student_answer TEXT,
  is_correct BOOLEAN,
  points_earned INT DEFAULT 0,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_answers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- RLS Policies for quizzes
CREATE POLICY "Anyone can view active quizzes"
  ON public.quizzes FOR SELECT
  USING (is_active = true OR created_by = auth.uid());

CREATE POLICY "Admins can create quizzes"
  ON public.quizzes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update their own quizzes"
  ON public.quizzes FOR UPDATE
  USING (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete their own quizzes"
  ON public.quizzes FOR DELETE
  USING (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for questions
CREATE POLICY "Users can view questions for active quizzes"
  ON public.questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quizzes
      WHERE id = quiz_id AND (is_active = true OR created_by = auth.uid())
    )
  );

CREATE POLICY "Admins can manage questions for their quizzes"
  ON public.questions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE q.id = quiz_id AND q.created_by = auth.uid() AND p.role = 'admin'
    )
  );

-- RLS Policies for quiz_attempts
CREATE POLICY "Students can view their own attempts"
  ON public.quiz_attempts FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY "Students can create their own attempts"
  ON public.quiz_attempts FOR INSERT
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students can update their own attempts"
  ON public.quiz_attempts FOR UPDATE
  USING (student_id = auth.uid());

CREATE POLICY "Admins can view all attempts for their quizzes"
  ON public.quiz_attempts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE q.id = quiz_id AND q.created_by = auth.uid() AND p.role = 'admin'
    )
  );

-- RLS Policies for student_answers
CREATE POLICY "Students can view their own answers"
  ON public.student_answers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quiz_attempts
      WHERE id = attempt_id AND student_id = auth.uid()
    )
  );

CREATE POLICY "Students can create their own answers"
  ON public.student_answers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quiz_attempts
      WHERE id = attempt_id AND student_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all answers for their quizzes"
  ON public.student_answers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quiz_attempts qa
      JOIN public.quizzes q ON q.id = qa.quiz_id
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE qa.id = attempt_id AND q.created_by = auth.uid() AND p.role = 'admin'
    )
  );

-- Create function to automatically create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'student')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updating timestamps
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_quizzes_updated_at
  BEFORE UPDATE ON public.quizzes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();