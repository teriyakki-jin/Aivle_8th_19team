import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Edit, X, Save, User, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

interface Post {
    id: number;
    title: string;
    content: string;
    author_name: string;
    author_id: number;
    created_at: string;
}

export const BoardDetailPage = () => {
    const { id } = useParams();
    const [post, setPost] = useState<Post | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const [editContent, setEditContent] = useState('');
    const [updateLoading, setUpdateLoading] = useState(false);
    const navigate = useNavigate();
    const currentUser = localStorage.getItem('username');
    const token = localStorage.getItem('token');
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

    useEffect(() => {
        fetchPost();
    }, [id]);

    const fetchPost = async () => {
        try {
            const headers: HeadersInit = {};
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            
            const response = await fetch(`/api/v1/board/${id}`, { headers });
            if (response.ok) {
                const data = await response.json();
                setPost(data);
                setEditTitle(data.title);
                setEditContent(data.content);
            } else {
                setError('게시글을 찾을 수 없습니다.');
            }
        } catch (err) {
            setError('게시글을 불러오는데 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async () => {
        if (!token) {
            alert('로그인이 필요합니다.');
            return;
        }

        setUpdateLoading(true);
        try {
            const response = await fetch(`/api/v1/board/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ title: editTitle, content: editContent })
            });

            if (response.ok) {
                const updatedPost = await response.json();
                setPost(updatedPost);
                setIsEditing(false);
                alert('게시글이 수정되었습니다.');
            } else {
                alert('게시글 수정에 실패했습니다. (본인 글만 수정 가능합니다)');
            }
        } catch (error) {
            alert('서버 오류가 발생했습니다.');
        } finally {
            setUpdateLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('정말 이 게시글을 삭제하시겠습니까?')) return;

        try {
            const response = await fetch(`/api/v1/board/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                alert('게시글이 삭제되었습니다.');
                navigate('/board');
            } else {
                alert('게시글 삭제에 실패했습니다.');
            }
        } catch (error) {
            alert('서버 오류가 발생했습니다.');
        }
    };

    const startEditing = () => {
        setIsEditing(true);
        setEditTitle(post?.title || '');
        setEditContent(post?.content || '');
    };

    const cancelEditing = () => {
        setIsEditing(false);
        setEditTitle(post?.title || '');
        setEditContent(post?.content || '');
    };

    if (loading) {
        return (
            <div className="p-8 flex justify-center items-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-500">게시글을 불러오는 중...</p>
                </div>
            </div>
        );
    }

    if (error || !post) {
        return (
            <div className="p-8 max-w-5xl mx-auto">
                <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
                    {error || '게시글을 찾을 수 없습니다.'}
                </div>
                <Button 
                    variant="outline" 
                    onClick={() => navigate('/board')}
                    className="mt-4"
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    목록으로 돌아가기
                </Button>
            </div>
        );
    }

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
                    <h1 className="text-3xl font-bold text-gray-900">게시글 상세</h1>
                    <p className="text-gray-600 mt-1">게시글 내용을 확인하세요</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                {isEditing ? (
                    // Edit Mode
                    <div className="p-8">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-900">게시글 수정</h3>
                            <button
                                onClick={cancelEditing}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="space-y-6">
                            <div>
                                <Label htmlFor="edit-title" className="text-base font-semibold text-gray-700">제목</Label>
                                <Input
                                    id="edit-title"
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    className="mt-2 text-lg px-4 py-3"
                                />
                            </div>
                            <div>
                                <Label htmlFor="edit-content" className="text-base font-semibold text-gray-700">내용</Label>
                                <div className="mt-2">
                                    <ReactQuill
                                        ref={quillRef}
                                        theme="snow"
                                        value={editContent}
                                        onChange={setEditContent}
                                        modules={modules}
                                        formats={formats}
                                        className="bg-white"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3 justify-end pt-6 border-t border-gray-200 mt-6">
                                <Button
                                    variant="ghost"
                                    onClick={cancelEditing}
                                    className="px-8 py-2.5 text-gray-700 hover:bg-gray-100 font-medium"
                                >
                                    취소
                                </Button>
                                <Button
                                    onClick={handleUpdate}
                                    disabled={updateLoading}
                                    className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {updateLoading ? '저장 중...' : '저장하기'}
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    // View Mode
                    <>
                        <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-transparent">
                            <div className="flex justify-between items-start gap-4">
                                <div className="flex-1 min-w-0">
                                    <h2 className="text-3xl font-bold text-gray-900 mb-4">{post.title}</h2>
                                    <div className="flex items-center gap-4 text-sm text-gray-600">
                                        <span className="flex items-center gap-1">
                                            <User className="w-4 h-4" />
                                            <span className="font-medium">작성자:</span> {post.author_name}
                                        </span>
                                        <span className="text-gray-400">•</span>
                                        <span className="flex items-center gap-1">
                                            <Calendar className="w-4 h-4" />
                                            {new Date(post.created_at).toLocaleDateString('ko-KR', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="p-8">
                            <div 
                                className="prose max-w-none"
                                dangerouslySetInnerHTML={{ __html: post.content }}
                            />
                        </div>
                    </>
                )}
            </div>

            {!isEditing && (
                <div className="mt-8 flex justify-center gap-3">
                    <Button
                        variant="outline"
                        onClick={() => navigate('/board')}
                        className="px-6 py-2.5 border-2 border-blue-500 text-blue-600 hover:bg-blue-50 hover:border-blue-600 font-semibold transition-all"
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        목록으로
                    </Button>
                    {token && (
                        <>
                            <Button
                                variant="outline"
                                onClick={startEditing}
                                className="px-6 py-2.5 border-2 border-blue-500 text-blue-600 hover:bg-blue-50 hover:border-blue-600 font-semibold transition-all"
                            >
                                <Edit className="mr-2 h-4 w-4" />
                                수정
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={handleDelete}
                                className="px-6 py-2.5 border-2 border-blue-500 text-blue-600 hover:bg-blue-50 hover:border-blue-600 font-semibold transition-all"
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                삭제
                            </Button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};
