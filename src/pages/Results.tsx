import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CheckCircle, XCircle, Trophy } from 'lucide-react';

interface Answer {
  question_id: string;
  student_answer: string;
  is_correct: boolean;
  points_earned: number;
  questions: {
    question_text: string;
    question_type: string;
    correct_answer: string;
    options: string[];
  };
}

interface Attempt {
  score: number;
  total_points: number;
  submitted_at: string;
  time_taken_seconds: number;
  quizzes: {
    title: string;
  };
}

export default function Results() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (attemptId) {
      fetchResults();
    }
  }, [attemptId]);

  const fetchResults = async () => {
    try {
      const { data: attemptData, error: attemptError } = await supabase
        .from('quiz_attempts')
        .select(`
          *,
          quizzes (title)
        `)
        .eq('id', attemptId)
        .single();

      if (attemptError) throw attemptError;

      const { data: answersData, error: answersError } = await supabase
        .from('student_answers')
        .select(`
          *,
          questions (
            question_text,
            question_type,
            correct_answer,
            options
          )
        `)
        .eq('attempt_id', attemptId)
        .order('answered_at');

      if (answersError) throw answersError;

      setAttempt(attemptData as any);
      setAnswers(answersData as any);
    } catch (error: any) {
      console.error('Error fetching results:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading results...</p>
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Results not found</p>
      </div>
    );
  }

  const percentage = (attempt.score / attempt.total_points) * 100;
  const correctAnswers = answers.filter(a => a.is_correct).length;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <Button variant="ghost" onClick={() => navigate('/student')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="mb-6">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Trophy className="h-10 w-10 text-primary" />
            </div>
            <CardTitle className="text-3xl">{attempt.quizzes.title}</CardTitle>
            <CardDescription>Quiz Results</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-3xl font-bold text-primary">{percentage.toFixed(1)}%</p>
                <p className="text-sm text-muted-foreground">Score</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-3xl font-bold">{attempt.score}/{attempt.total_points}</p>
                <p className="text-sm text-muted-foreground">Points</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-3xl font-bold">{correctAnswers}/{answers.length}</p>
                <p className="text-sm text-muted-foreground">Correct</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-3xl font-bold">
                  {Math.floor(attempt.time_taken_seconds / 60)}:{(attempt.time_taken_seconds % 60).toString().padStart(2, '0')}
                </p>
                <p className="text-sm text-muted-foreground">Time</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Answer Review</h2>
          {answers.map((answer, index) => (
            <Card key={answer.question_id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg flex items-start gap-2">
                    <span>Question {index + 1}:</span>
                    <span className="font-normal">{answer.questions.question_text}</span>
                  </CardTitle>
                  {answer.is_correct ? (
                    <Badge className="bg-success">
                      <CheckCircle className="mr-1 h-3 w-3" />
                      Correct
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <XCircle className="mr-1 h-3 w-3" />
                      Incorrect
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Your Answer:</p>
                  <p className={answer.is_correct ? 'text-success' : 'text-destructive'}>
                    {answer.student_answer || '(No answer)'}
                  </p>
                </div>
                {!answer.is_correct && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Correct Answer:</p>
                    <p className="text-success">{answer.questions.correct_answer}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">
                    Points: {answer.points_earned} / {answer.points_earned + (answer.is_correct ? 0 : 1)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}