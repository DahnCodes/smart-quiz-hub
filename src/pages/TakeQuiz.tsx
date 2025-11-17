import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Clock, ArrowRight, CheckCircle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  options: string[];
  correct_answer: string;
  points: number;
}

interface Quiz {
  id: string;
  title: string;
  duration_minutes: number;
  instructions: string;
  randomize_questions: boolean;
  randomize_options: boolean;
}

export default function TakeQuiz() {
  const { quizId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showTimeUpDialog, setShowTimeUpDialog] = useState(false);

  useEffect(() => {
    if (quizId) {
      fetchQuizAndQuestions();
    }
  }, [quizId]);

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && attemptId) {
      setShowTimeUpDialog(true);
      handleSubmit(true);
    }
  }, [timeLeft]);

  const fetchQuizAndQuestions = async () => {
    try {
      const { data: quizData, error: quizError } = await supabase
        .from('quizzes')
        .select('*')
        .eq('id', quizId)
        .single();

      if (quizError) throw quizError;

      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .eq('quiz_id', quizId);

      if (questionsError) throw questionsError;

      setQuiz(quizData);
      
      // Randomize questions if enabled
      let processedQuestions = [...questionsData].map(q => ({
        ...q,
        options: Array.isArray(q.options) ? q.options as string[] : []
      }));
      
      if (quizData.randomize_questions) {
        processedQuestions = processedQuestions.sort(() => Math.random() - 0.5);
      }

      // Randomize options if enabled
      if (quizData.randomize_options) {
        processedQuestions = processedQuestions.map(q => {
          if (q.question_type === 'mcq' && q.options) {
            return {
              ...q,
              options: [...q.options].sort(() => Math.random() - 0.5)
            };
          }
          return q;
        });
      }

      setQuestions(processedQuestions as Question[]);
      setTimeLeft(quizData.duration_minutes * 60);

      // Create attempt
      const { data: attempt, error: attemptError } = await supabase
        .from('quiz_attempts')
        .insert({
          quiz_id: quizId,
          student_id: user?.id,
        })
        .select()
        .single();

      if (attemptError) throw attemptError;
      setAttemptId(attempt.id);
    } catch (error: any) {
      console.error('Error fetching quiz:', error);
      toast.error('Failed to load quiz');
      navigate('/student');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (autoSubmit = false) => {
    if (!attemptId) return;

    setSubmitting(true);
    try {
      const startTime = quiz!.duration_minutes * 60;
      const timeTaken = startTime - timeLeft;

      // Calculate score
      let score = 0;
      let totalPoints = 0;
      const answersData = [];

      for (const question of questions) {
        totalPoints += question.points;
        const studentAnswer = answers[question.id] || '';
        const isCorrect = studentAnswer.trim().toLowerCase() === 
                         question.correct_answer.trim().toLowerCase();
        const pointsEarned = isCorrect ? question.points : 0;
        score += pointsEarned;

        answersData.push({
          attempt_id: attemptId,
          question_id: question.id,
          student_answer: studentAnswer,
          is_correct: isCorrect,
          points_earned: pointsEarned,
        });
      }

      // Save answers
      const { error: answersError } = await supabase
        .from('student_answers')
        .insert(answersData);

      if (answersError) throw answersError;

      // Update attempt
      const { error: updateError } = await supabase
        .from('quiz_attempts')
        .update({
          submitted_at: new Date().toISOString(),
          score,
          total_points: totalPoints,
          time_taken_seconds: timeTaken,
        })
        .eq('id', attemptId);

      if (updateError) throw updateError;

      if (!autoSubmit) {
        toast.success('Quiz submitted successfully!');
      }
      navigate(`/results/${attemptId}`);
    } catch (error: any) {
      console.error('Error submitting quiz:', error);
      toast.error('Failed to submit quiz');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading quiz...</p>
      </div>
    );
  }

  if (!quiz || questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Quiz not found</p>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">{quiz.title}</h1>
              <p className="text-sm text-muted-foreground">
                Question {currentQuestionIndex + 1} of {questions.length}
              </p>
            </div>
            <div className="flex items-center gap-2 text-lg font-semibold">
              <Clock className="h-5 w-5" />
              <span className={timeLeft < 60 ? 'text-destructive' : ''}>
                {formatTime(timeLeft)}
              </span>
            </div>
          </div>
          <Progress value={progress} className="mt-2" />
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Question {currentQuestionIndex + 1}</CardTitle>
            <CardDescription>{currentQuestion.question_text}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentQuestion.question_type === 'mcq' && (
              <RadioGroup
                value={answers[currentQuestion.id] || ''}
                onValueChange={(value) => setAnswers({
                  ...answers,
                  [currentQuestion.id]: value,
                })}
              >
                {currentQuestion.options?.map((option, index) => (
                  <div key={index} className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50">
                    <RadioGroupItem value={option} id={`option-${index}`} />
                    <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer">
                      {option}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}

            {currentQuestion.question_type === 'true_false' && (
              <RadioGroup
                value={answers[currentQuestion.id] || ''}
                onValueChange={(value) => setAnswers({
                  ...answers,
                  [currentQuestion.id]: value,
                })}
              >
                {['True', 'False'].map((option) => (
                  <div key={option} className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50">
                    <RadioGroupItem value={option} id={option} />
                    <Label htmlFor={option} className="flex-1 cursor-pointer">
                      {option}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}

            {currentQuestion.question_type === 'short_answer' && (
              <Input
                value={answers[currentQuestion.id] || ''}
                onChange={(e) => setAnswers({
                  ...answers,
                  [currentQuestion.id]: e.target.value,
                })}
                placeholder="Type your answer here"
              />
            )}

            <div className="flex gap-2 pt-4">
              {currentQuestionIndex < questions.length - 1 ? (
                <Button
                  onClick={() => setCurrentQuestionIndex(currentQuestionIndex + 1)}
                  className="flex-1"
                >
                  Next Question
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={() => handleSubmit(false)}
                  disabled={submitting}
                  className="flex-1"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  {submitting ? 'Submitting...' : 'Submit Quiz'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={showTimeUpDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Time's Up!</AlertDialogTitle>
            <AlertDialogDescription>
              Your quiz has been automatically submitted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => navigate(`/results/${attemptId}`)}>
              View Results
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}