import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { GraduationCap, UserCog } from 'lucide-react';
import { useEffect } from 'react';

export default function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'student' | 'admin'>('student');
  const [loading, setLoading] = useState(false);
  const { signUp, signIn, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        await signUp(email, password, fullName, role);
      } else {
        await signIn(email, password);
      }
    } catch (error) {
      // Error handling is done in the context
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-primary p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <GraduationCap className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl text-center">CBT Platform</CardTitle>
          <CardDescription className="text-center">
            {isSignUp ? 'Create your account to get started' : 'Sign in to continue'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={isSignUp ? 'signup' : 'signin'} onValueChange={(v) => setIsSignUp(v === 'signup')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {isSignUp && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="Enter your full name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>I am a</Label>
                    <RadioGroup value={role} onValueChange={(v) => setRole(v as 'student' | 'admin')}>
                      <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                        <RadioGroupItem value="student" id="student" />
                        <Label htmlFor="student" className="flex items-center gap-2 cursor-pointer flex-1">
                          <GraduationCap className="h-4 w-4" />
                          Student
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                        <RadioGroupItem value="admin" id="admin" />
                        <Label htmlFor="admin" className="flex items-center gap-2 cursor-pointer flex-1">
                          <UserCog className="h-4 w-4" />
                          Admin
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Please wait...' : (isSignUp ? 'Create Account' : 'Sign In')}
              </Button>
            </form>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}