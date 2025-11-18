import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, Users, TrendingUp, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Quiz {
  id: string;
  title: string;
  subject: string;
  description: string;
  duration_minutes: number;
  is_active: boolean;
  created_at: string;
  class: string;
}

interface QuizStats {
  attempts: number;
  avg_score: number;
  highest_score: number;
}

export default function AdminDashboard() {
  const { signOut } = useAuth();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [stats, setStats] = useState<Record<string, QuizStats>>({});
  const [loading, setLoading] = useState(true);
  const [deleteQuizId, setDeleteQuizId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const fetchQuizzes = async () => {
    try {
      const { data, error } = await supabase
        .from('quizzes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQuizzes(data || []);
      
      if (data) {
        data.forEach(quiz => fetchQuizStats(quiz.id));
      }
    } catch (error: any) {
      console.error('Error fetching quizzes:', error);
      toast.error('Failed to load tests');
    } finally {
      setLoading(false);
    }
  };

  const fetchQuizStats = async (quizId: string) => {
    try {
      const { data, error } = await supabase
        .from('quiz_attempts')
        .select('score, total_points')
        .eq('quiz_id', quizId)
        .not('submitted_at', 'is', null);

      if (error) throw error;

      const attempts = data?.length || 0;
      const scores = data?.map(a => (a.score / a.total_points) * 100) || [];
      const avg_score = scores.length > 0 
        ? scores.reduce((a, b) => a + b, 0) / scores.length 
        : 0;
      const highest_score = scores.length > 0 ? Math.max(...scores) : 0;

      setStats(prev => ({
        ...prev,
        [quizId]: { attempts, avg_score, highest_score }
      }));
    } catch (error: any) {
      console.error('Error fetching quiz stats:', error);
    }
  };

  const handleDeleteQuiz = async (quizId: string) => {
    try {
      const { error } = await supabase
        .from('quizzes')
        .delete()
        .eq('id', quizId);

      if (error) throw error;

      toast.success('Test deleted successfully');
      setQuizzes(quizzes.filter(q => q.id !== quizId));
      setDeleteQuizId(null);
    } catch (error: any) {
      console.error('Error deleting quiz:', error);
      toast.error('Failed to delete test');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Manage Tests</h1>
              <p className="text-muted-foreground mt-1">Create tests and view results</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => navigate('/admin/create-quiz')}>
                <Plus className="mr-2 h-4 w-4" />
                Create New Test
              </Button>
              <Button variant="outline" onClick={signOut}>
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading tests...</p>
          </div>
        ) : quizzes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg text-muted-foreground">No tests created yet</p>
              <p className="text-sm text-muted-foreground mt-2 mb-4">
                Create your first test to get started
              </p>
              <Button onClick={() => navigate('/admin/create-quiz')}>
                <Plus className="mr-2 h-4 w-4" />
                Create Test
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {quizzes.map((quiz) => (
              <Card key={quiz.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-xl">{quiz.title}</CardTitle>
                        <Badge variant={quiz.is_active ? 'default' : 'secondary'}>
                          {quiz.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      {quiz.subject && (
                        <Badge variant="outline" className="mt-2">
                          {quiz.subject}
                        </Badge>
                      )}
                      <CardDescription className="mt-2">
                        {quiz.description || 'No description'}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm mb-4">
                    <p className="text-muted-foreground">
                      Duration: {quiz.duration_minutes} minutes
                    </p>
                    {quiz.class && (
                      <p className="text-muted-foreground">Class: {quiz.class}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <Users className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-sm font-medium">{stats[quiz.id]?.attempts || 0}</p>
                      <p className="text-xs text-muted-foreground">Attempts</p>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <TrendingUp className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-sm font-medium">
                        {stats[quiz.id]?.avg_score ? `${stats[quiz.id].avg_score.toFixed(1)}%` : 'N/A'}
                      </p>
                      <p className="text-xs text-muted-foreground">Avg Score</p>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <TrendingUp className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-sm font-medium">
                        {stats[quiz.id]?.highest_score ? `${stats[quiz.id].highest_score.toFixed(1)}%` : 'N/A'}
                      </p>
                      <p className="text-xs text-muted-foreground">Highest</p>
                    </div>
                  </div>
                  <Button 
                    variant="destructive" 
                    onClick={() => setDeleteQuizId(quiz.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteQuizId} onOpenChange={() => setDeleteQuizId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Test</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure? This will permanently delete this test and all associated questions.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteQuizId && handleDeleteQuiz(deleteQuizId)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
