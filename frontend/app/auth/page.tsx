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
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css'
import 'react-toastify/dist/ReactToastify.css';

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
    if (!/[A-Z]/.test(password)) {
      return 'Must include at least one uppercase letter';
    }
    if (!/[a-z]/.test(password)) {
      return 'Must include at least one lowercase letter';
    }
    if (!/[0-9]/.test(password)) {
      return 'Must include at least one number';
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      return 'Must include at least one special character';
    }
    return '';
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
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
      setPasswordError(error);
      if (error) {
        toast.error(error, {
          position: 'top-right',
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: 'dark',
        });
        setFormError(error);
        return;
      }
    }
    setLoading(true);
    try {
      const endpoint =
        activeTab === 'signup'
          ? 'http://localhost:5000/signup'
          : 'http://localhost:5000/login';
      // Prepare payload based on tab
      let payload;
      if (activeTab === 'signup') {
        payload = {
          name: formData.username,
          email: formData.email,
          password: formData.password,
        };
      } else {
        payload = {
          email: formData.email,
          password: formData.password,
        };
      }
      const response = await axios.post(endpoint, payload);
      console.log('Backend response:', response);

      const isSuccess = response.status === 200 || response.status === 201;

      if (isSuccess) {
        toast.success(
          activeTab === 'signup'
            ? 'Account created successfully!'
            : 'Logged in successfully!',
          {
            position: 'top-right',
            autoClose: 2000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            theme: 'dark',
          }
        );
        if (response.data.token) {
          // Store the token in localStorage
          if (typeof window !== 'undefined') {
            localStorage.setItem('token', response.data.token);
          }
          // Navigate to home after a short delay
          setTimeout(() => {
            router.push('/dashboard');
          }, 1000);
        } else if (activeTab === 'signup') {
          setActiveTab('login');
          setFormData({ username: '', email: '', password: '' });
        }
      }
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as any).response === 'object' &&
        (error as any).response !== null &&
        'data' in (error as any).response
      ) {
        const message = (error as any).response.data?.message || 'Something went wrong! Please try again.';
        setFormError(message);
        toast.error(message, {
          position: 'top-right',
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: 'dark',
        });
      } else {
        setFormError('Something went wrong! Please try again.');
        toast.error('Something went wrong! Please try again.', {
          position: 'top-right',
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: 'dark',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={true}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />
      <div className="w-full max-w-lg p-4">
        <Tabs defaultValue="login" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full mb-6">
            <TabsTrigger value="login" className="flex-1">Sign In</TabsTrigger>
            <TabsTrigger value="signup" className="flex-1">Sign Up</TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <Card>
              <CardHeader>
                <CardTitle>Sign in to your account</CardTitle>
                <CardDescription>Enter your email and password to access your account</CardDescription>
              </CardHeader>
              <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4">
                  <div className="mb-4 space-y-1">
                    <Label htmlFor="email">User Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="Enter your email"
                      required
                    />
                  </div>
                  <div className="mb-4 space-y-1">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={handleInputChange}
                        placeholder="Enter your password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-2 mt-4">
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Signing In...' : 'Sign In'}
                  </Button>
                  {formError && <div className="text-red-500 text-xs text-center">{formError}</div>}
                  {formSuccess && <div className="text-green-600 text-xs text-center">{formSuccess}</div>}
                </CardFooter>
              </form>
            </Card>
          </TabsContent>
          <TabsContent value="signup">
            <Card>
              <CardHeader>
                <CardTitle>Create Account</CardTitle>
                <CardDescription>Make your new account here.</CardDescription>
              </CardHeader>
              <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4">
                  <div className="mb-4 space-y-1">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      name="username"
                      value={formData.username}
                      onChange={handleInputChange}
                      placeholder="Choose your username"
                      required
                    />
                  </div>
                  <div className="mb-4 space-y-1">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="Enter your email"
                      required
                    />
                  </div>
                  <div className="mb-4 space-y-1">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={handleInputChange}
                        placeholder="Create a strong password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    {activeTab === 'signup' && passwordError && (
                      <div className="text-red-500 text-xs mt-1">{passwordError}</div>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-2 mt-4">
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Creating Account...' : 'Create Account'}
                  </Button>
                  {formError && <div className="text-red-500 text-xs text-center">{formError}</div>}
                  {formSuccess && <div className="text-green-600 text-xs text-center">{formSuccess}</div>}
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
