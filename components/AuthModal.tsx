import React, { useState } from 'react';
import { ClearIcon } from './Icons';

interface AuthModalProps {
    visible: boolean;
    onClose: () => void;
    onSignIn: (email: string, password: string) => Promise<{ error: any }>;
    onSignUp: (email: string, password: string) => Promise<{ error: any }>;
}

const AuthModal: React.FC<AuthModalProps> = ({ visible, onClose, onSignIn, onSignUp }) => {
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    if (!visible) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const { error: authError } = isSignUp
                ? await onSignUp(email, password)
                : await onSignIn(email, password);

            if (authError) {
                setError(authError.message);
            } else {
                onClose();
            }
        } catch (err: any) {
            setError(err.message || 'Произошла ошибка');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="position-fixed inset-0 z-2000 bg-black bg-opacity-75 d-flex align-items-center justify-content-center p-4">
            <div
                className="bg-gray-800 rounded shadow border border-secondary w-100 p-4 position-relative"
                style={{ maxWidth: '24rem' }}
            >
                <button
                    onClick={onClose}
                    className="position-absolute top-0 end-0 m-3 btn btn-link text-gray-400 p-0 border-0"
                    aria-label="Закрыть"
                >
                    <ClearIcon style={{ width: '1.5rem', height: '1.5rem' }} />
                </button>

                <h2 className="h5 fw-bold text-gray-100 mb-4 text-center">
                    {isSignUp ? 'Регистрация' : 'Вход'}
                </h2>

                <form onSubmit={handleSubmit} className="d-flex flex-column gap-3">
                    <div>
                        <label htmlFor="email" className="form-label small text-gray-300">
                            Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="form-control bg-gray-900 border-secondary text-white focus-warning"
                            required
                            autoComplete="email"
                        />
                    </div>

                    <div>
                        <label htmlFor="password" className="form-label small text-gray-300">
                            Пароль
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="form-control bg-gray-900 border-secondary text-white focus-warning"
                            required
                            autoComplete={isSignUp ? 'new-password' : 'current-password'}
                            minLength={6}
                        />
                    </div>

                    {error && (
                        <div className="alert alert-danger small p-2 mb-0" role="alert">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="btn btn-warning fw-bold"
                        disabled={loading}
                    >
                        {loading ? 'Загрузка...' : (isSignUp ? 'Зарегистрироваться' : 'Войти')}
                    </button>
                </form>

                <div className="text-center mt-3">
                    <button
                        onClick={() => {
                            setIsSignUp(!isSignUp);
                            setError('');
                        }}
                        className="btn btn-link text-gray-300 text-decoration-none small p-0"
                    >
                        {isSignUp ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AuthModal;
