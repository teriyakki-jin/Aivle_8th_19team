import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

export const BoardWritePage = () => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const quillRef = useRef<ReactQuill>(null);

    const modules = {
        toolbar: [
            [{ 'header': [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            [{ 'color': [] }, { 'background': [] }],
            ['link', 'image'],
            ['clean']
        ]
    };

    const formats = [
        'header',
        'bold', 'italic', 'underline', 'strike',
        'list', 'bullet',
        'color', 'background',
        'link', 'image'
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const token = localStorage.getItem('token');
        if (!token) {
            setError('로그인이 필요합니다.');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch('/api/v1/board', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ title, content }),
            });

            if (response.ok) {
                navigate('/board');
            } else {
                const data = await response.json();
                setError(data.error || '게시글 작성에 실패했습니다.');
            }
        } catch (err) {
            setError('서버 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <div className="flex items-center gap-4 mb-8">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => navigate('/board')}
                    className="hover:bg-gray-100"
                >
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">새 게시글 작성</h1>
                    <p className="text-gray-600 mt-1">내용을 작성하고 공유하세요</p>
                </div>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="title" className="text-base font-semibold text-gray-700">제목</Label>
                        <Input
                            id="title"
                            placeholder="게시글 제목을 입력하세요"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="text-lg px-4 py-3 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="content" className="text-base font-semibold text-gray-700">내용</Label>
                        <ReactQuill
                            ref={quillRef}
                            theme="snow"
                            value={content}
                            onChange={setContent}
                            modules={modules}
                            formats={formats}
                            className="bg-white rounded-lg"
                            placeholder="내용을 입력하세요..."
                        />
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                            {error}
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 mt-6">
                        <Button 
                            type="button" 
                            variant="ghost" 
                            onClick={() => navigate('/board')}
                            className="px-8 py-2.5 text-gray-700 hover:bg-gray-100 font-medium"
                        >
                            취소
                        </Button>
                        <Button 
                            type="submit"
                            disabled={loading}
                            className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? '등록 중...' : '게시글 등록'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};
