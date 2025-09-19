import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LoginForm } from '../components/LoginForm';

export function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (password: string) => {
    const result = await login(password);

    if (result.success) {
      navigate('/', { replace: true });
    }

    return result;
  };

  return <LoginForm onSubmit={handleLogin} />;
}