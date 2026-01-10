"use client";
import React, { useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Eye, EyeOff } from 'lucide-react';
import { FcGoogle } from 'react-icons/fc';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { BACKEND_URL } from '../../config';

function AuthPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('signup');
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const validatePassword = (password: string): string => {
    if (!/[A-Z]/.test(password)) return 'Must include at least one uppercase letter';
    if (!/[a-z]/.test(password)) return 'Must include at least one lowercase letter';
    if (!/[0-9]/.test(password)) return 'Must include at least one number';
    if (!/[^A-Za-z0-9]/.test(password)) return 'Must include at least one special character';
    return '';
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (activeTab === 'signup' && name === 'password') {
      setPasswordError(validatePassword(value));
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    if (activeTab === 'signup') {
      const error = validatePassword(formData.password);
      if (error) {
        toast.error(error, { theme: 'dark' });
        setFormError(error);
        return;
      }
    }
    setLoading(true);
    try {
      const endpoint = activeTab === 'signup' ? `${BACKEND_URL}/signup` : `${BACKEND_URL}/login`;
      let payload = activeTab === 'signup' 
        ? { name: formData.username, email: formData.email, password: formData.password }
        : { email: formData.email, password: formData.password };
      
      const response = await axios.post(endpoint, payload);

      if (response.status === 200 || response.status === 201) {
        toast.success(activeTab === 'signup' ? 'Account created successfully!' : 'Logged in successfully!', { theme: 'dark' });
        if (response.data.token) {
          localStorage.setItem('token', response.data.token);
          setTimeout(() => router.push('/dashboard'), 1000);
        } else if (activeTab === 'signup') {
          setActiveTab('login');
          setFormData({ username: '', email: '', password: '' });
        }
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'Something went wrong!';
      setFormError(message);
      toast.error(message, { theme: 'dark' });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `${BACKEND_URL}/auth/google`;
  };

  // Reusable Google Section to avoid repetition
  const GoogleAuthSection = () => (
    <>
      <div className="relative w-full text-center my-2">
        <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
        <span className="relative text-xs text-muted-foreground bg-card px-2 uppercase">Or</span>
      </div>
      <Button
        type="button"
        variant="outline"
        className="w-full flex items-center gap-2"
        onClick={handleGoogleLogin}
      >
        <FcGoogle className="h-5 w-5" />
        Continue with Google
      </Button>
    </>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <ToastContainer position="top-right" autoClose={3000} theme="dark" />
      <div className="w-full max-w-lg p-4">
        <Tabs defaultValue="login" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full mb-6">
            <TabsTrigger value="login" className="flex-1">Sign In</TabsTrigger>
            <TabsTrigger value="signup" className="flex-1">Sign Up</TabsTrigger>
          </TabsList>

          {/* LOGIN TAB */}
          <TabsContent value="login">
            <Card>
              <CardHeader>
                <CardTitle>Sign in to your account</CardTitle>
                <CardDescription>Enter your email and password to access your account</CardDescription>
              </CardHeader>
              <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4">
                  <div className="space-y-1">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" value={formData.email} onChange={handleInputChange} required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input id="password" name="password" type={showPassword ? 'text' : 'password'} value={formData.password} onChange={handleInputChange} required />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2">
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-2">
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Signing In...' : 'Sign In'}
                  </Button>
                  <GoogleAuthSection />
                  {formError && <div className="text-red-500 text-xs text-center mt-2">{formError}</div>}
                </CardFooter>
              </form>
            </Card>
          </TabsContent>

          {/* SIGNUP TAB */}
          <TabsContent value="signup">
            <Card>
              <CardHeader>
                <CardTitle>Create Account</CardTitle>
                <CardDescription>Make your new account here.</CardDescription>
              </CardHeader>
              <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4">
                  <div className="space-y-1">
                    <Label htmlFor="username">Username</Label>
                    <Input id="username" name="username" value={formData.username} onChange={handleInputChange} required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="email_signup">Email</Label>
                    <Input id="email_signup" name="email" type="email" value={formData.email} onChange={handleInputChange} required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="password_signup">Password</Label>
                    <div className="relative">
                      <Input id="password_signup" name="password" type={showPassword ? 'text' : 'password'} value={formData.password} onChange={handleInputChange} required />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2">
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    {passwordError && <div className="text-red-500 text-xs mt-1">{passwordError}</div>}
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-2">
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Signing Up...' : 'Sign Up'}
                  </Button>
                  <GoogleAuthSection />
                  {formError && <div className="text-red-500 text-xs text-center mt-2">{formError}</div>}
                </CardFooter>
              </form>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default AuthPage;