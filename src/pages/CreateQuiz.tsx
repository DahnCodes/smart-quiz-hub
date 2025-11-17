import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';

interface Question {
  id: string;
  question_text: string;
  question_type: 'mcq' | 'true_false' | 'short_answer';
  options: string[];
  correct_answer: string;
  points: number;
}

export default function CreateQuiz() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(30);
  const [instructions, setInstructions] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [randomizeQuestions, setRandomizeQuestions] = useState(true);
  const [randomizeOptions, setRandomizeOptions] = useState(true);
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Partial<Question>>({
    question_text: '',
    question_type: 'mcq',
    options: ['', '', '', ''],
    correct_answer: '',
    points: 1,
  });

  const handleAddQuestion = () => {
    if (!currentQuestion.question_text || !currentQuestion.correct_answer) {
      toast.error('Please fill in question text and correct answer');
      return;
    }

    if (currentQuestion.question_type === 'mcq' && 
        currentQuestion.options?.some(o => !o.trim())) {
      toast.error('Please fill in all options for MCQ');
      return;
    }

    const newQuestion: Question = {
      id: Math.random().toString(),
      question_text: currentQuestion.question_text,
      question_type: currentQuestion.question_type as any,
      options: currentQuestion.question_type === 'true_false' 
        ? ['True', 'False']
        : currentQuestion.options || [],
      correct_answer: currentQuestion.correct_answer,
      points: currentQuestion.points || 1,
    };

    setQuestions([...questions, newQuestion]);
    setCurrentQuestion({
      question_text: '',
      question_type: 'mcq',
      options: ['', '', '', ''],
      correct_answer: '',
      points: 1,
    });
    toast.success('Question added');
  };

  const handleRemoveQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const handleSubmit = async () => {
    if (!title || questions.length === 0) {
      toast.error('Please provide title and at least one question');
      return;
    }

    setLoading(true);
    try {
      // Create quiz
      const { data: quiz, error: quizError } = await supabase
        .from('quizzes')
        .insert({
          title,
          subject,
          description,
          duration_minutes: duration,
          instructions,
          is_active: isActive,
          randomize_questions: randomizeQuestions,
          randomize_options: randomizeOptions,
          created_by: user?.id,
        })
        .select()
        .single();

      if (quizError) throw quizError;

      // Create questions
      const questionsData = questions.map(q => ({
        quiz_id: quiz.id,
        question_text: q.question_text,
        question_type: q.question_type,
        options: q.options,
        correct_answer: q.correct_answer,
        points: q.points,
      }));

      const { error: questionsError } = await supabase
        .from('questions')
        .insert(questionsData);

      if (questionsError) throw questionsError;

      toast.success('Quiz created successfully!');
      navigate('/admin');
    } catch (error: any) {
      console.error('Error creating quiz:', error);
      toast.error('Failed to create quiz');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <Button variant="ghost" onClick={() => navigate('/admin')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">Create New Quiz</h1>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quiz Details</CardTitle>
              <CardDescription>Basic information about your quiz</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Mathematics Quiz 1"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g., Mathematics"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of the quiz"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration">Duration (minutes) *</Label>
                <Input
                  id="duration"
                  type="number"
                  min="1"
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="instructions">Instructions</Label>
                <Textarea
                  id="instructions"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Instructions for students"
                  rows={3}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="active">Active</Label>
                <Switch
                  id="active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="randomize-q">Randomize Questions</Label>
                <Switch
                  id="randomize-q"
                  checked={randomizeQuestions}
                  onCheckedChange={setRandomizeQuestions}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="randomize-o">Randomize Options</Label>
                <Switch
                  id="randomize-o"
                  checked={randomizeOptions}
                  onCheckedChange={setRandomizeOptions}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Questions ({questions.length})</CardTitle>
              <CardDescription>Add questions to your quiz</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {questions.map((q, index) => (
                <div key={q.id} className="p-4 border rounded-lg bg-muted/30">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <p className="font-medium">Question {index + 1}: {q.question_text}</p>
                      <p className="text-sm text-muted-foreground">
                        Type: {q.question_type.toUpperCase()} | Points: {q.points}
                      </p>
                      {q.question_type !== 'short_answer' && (
                        <p className="text-sm text-success mt-1">
                          Correct Answer: {q.correct_answer}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveQuestion(q.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {q.question_type === 'mcq' && q.options && (
                    <div className="mt-2 pl-4">
                      {q.options.map((opt, i) => (
                        <p key={i} className="text-sm">• {opt}</p>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              <div className="border-t pt-6 space-y-4">
                <h3 className="font-semibold">Add New Question</h3>
                
                <div className="space-y-2">
                  <Label>Question Type</Label>
                  <Select
                    value={currentQuestion.question_type}
                    onValueChange={(v) => setCurrentQuestion({
                      ...currentQuestion,
                      question_type: v as any,
                      options: v === 'true_false' ? ['True', 'False'] : ['', '', '', ''],
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mcq">Multiple Choice</SelectItem>
                      <SelectItem value="true_false">True/False</SelectItem>
                      <SelectItem value="short_answer">Short Answer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Question Text</Label>
                  <Textarea
                    value={currentQuestion.question_text}
                    onChange={(e) => setCurrentQuestion({
                      ...currentQuestion,
                      question_text: e.target.value,
                    })}
                    placeholder="Enter your question"
                    rows={2}
                  />
                </div>

                {currentQuestion.question_type === 'mcq' && (
                  <div className="space-y-2">
                    <Label>Options</Label>
                    {[0, 1, 2, 3].map((i) => (
                      <Input
                        key={i}
                        value={currentQuestion.options?.[i] || ''}
                        onChange={(e) => {
                          const newOptions = [...(currentQuestion.options || [])];
                          newOptions[i] = e.target.value;
                          setCurrentQuestion({
                            ...currentQuestion,
                            options: newOptions,
                          });
                        }}
                        placeholder={`Option ${i + 1}`}
                      />
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Correct Answer</Label>
                  <Input
                    value={currentQuestion.correct_answer}
                    onChange={(e) => setCurrentQuestion({
                      ...currentQuestion,
                      correct_answer: e.target.value,
                    })}
                    placeholder={
                      currentQuestion.question_type === 'mcq'
                        ? 'Enter the exact correct option'
                        : currentQuestion.question_type === 'true_false'
                        ? 'True or False'
                        : 'Enter the correct answer'
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Points</Label>
                  <Input
                    type="number"
                    min="1"
                    value={currentQuestion.points}
                    onChange={(e) => setCurrentQuestion({
                      ...currentQuestion,
                      points: parseInt(e.target.value),
                    })}
                  />
                </div>

                <Button onClick={handleAddQuestion} variant="outline" className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Question
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button
              onClick={handleSubmit}
              disabled={loading || questions.length === 0}
              className="flex-1"
            >
              {loading ? 'Creating...' : 'Create Quiz'}
            </Button>
            <Button variant="outline" onClick={() => navigate('/admin')}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}