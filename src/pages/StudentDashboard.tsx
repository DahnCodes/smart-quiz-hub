import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Clock, BookOpen, Trophy, Play } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Quiz {
  id: string;
  title: string;
  subject: string;
  description: string;
  duration_minutes: number;
  instructions: string;
}

interface Attempt {
  id: string;
  score: number;
  total_points: number;
  submitted_at: string;
  quiz_id: string;
}

export default function StudentDashboard() {
  const { profile } = useAuth();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchQuizzes();
    fetchAttempts();
  }, []);

  const fetchQuizzes = async () => {
    try {
      const { data, error } = await supabase
        .from('quizzes')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQuizzes(data || []);
    } catch (error: any) {
      console.error('Error fetching quizzes:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttempts = async () => {
    try {
      const { data, error } = await supabase
        .from('quiz_attempts')
        .select('*')
        .order('submitted_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setAttempts(data || []);
    } catch (error: any) {
      console.error('Error fetching attempts:', error);
    }
  };

  const hasAttempted = (quizId: string) => {
    return attempts.some(a => a.quiz_id === quizId && a.submitted_at);
  };

  const getQuizScore = (quizId: string) => {
    const attempt = attempts.find(a => a.quiz_id === quizId && a.submitted_at);
    return attempt ? `${attempt.score}/${attempt.total_points}` : null;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Welcome, {profile?.full_name}
              </h1>
              <p className="text-muted-foreground mt-1">Ready to test your knowledge?</p>
            </div>
            <Button variant="outline" onClick={() => navigate('/results')}>
              <Trophy className="mr-2 h-4 w-4" />
              My Results
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading quizzes...</p>
          </div>
        ) : quizzes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg text-muted-foreground">No quizzes available yet</p>
              <p className="text-sm text-muted-foreground mt-2">Check back later for new quizzes</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {quizzes.map((quiz) => (
              <Card key={quiz.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl">{quiz.title}</CardTitle>
                      {quiz.subject && (
                        <Badge variant="secondary" className="mt-2">
                          {quiz.subject}
                        </Badge>
                      )}
                    </div>
                    {hasAttempted(quiz.id) && (
                      <Badge variant="outline" className="ml-2">
                        Attempted
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="mt-2">
                    {quiz.description || 'No description provided'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {quiz.duration_minutes} mins
                    </div>
                    {hasAttempted(quiz.id) && (
                      <div className="flex items-center gap-1">
                        <Trophy className="h-4 w-4" />
                        {getQuizScore(quiz.id)}
                      </div>
                    )}
                  </div>
                  <Button 
                    className="w-full" 
                    onClick={() => navigate(`/quiz/${quiz.id}`)}
                  >
                    <Play className="mr-2 h-4 w-4" />
                    {hasAttempted(quiz.id) ? 'Retake Quiz' : 'Start Quiz'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}