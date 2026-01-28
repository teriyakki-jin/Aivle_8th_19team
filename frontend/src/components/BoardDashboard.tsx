import { useState, useEffect } from 'react';
import { Plus, Trash2, MessageSquare, Edit, X, Save, Eye } from 'lucide-react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

interface Post {
    id: number;
    title: string;
    content: string;
    author_name: string;
    created_at: string;
    author_id: number;
}

export function BoardDashboard() {
    const [posts, setPosts] = useState<Post[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [newTitle, setNewTitle] = useState('');
    const [newContent, setNewContent] = useState('');
    const [editTitle, setEditTitle] = useState('');
    const [editContent, setEditContent] = useState('');
    const [loading, setLoading] = useState(false);

    // Get current user info from token (decoding logic simplified for demo)
    // In a real app, you'd decode the JWT properly or use a context
    const token = localStorage.getItem('token');

    const fetchPosts = async () => {
        try {
            const res = await fetch('/api/v1/board');
            if (res.ok) {
                const data = await res.json();
                setPosts(data);
            }
        } catch (error) {
            console.error('Failed to fetch posts', error);
        }
    };

    useEffect(() => {
        fetchPosts();
    }, []);

    const handleCreatePost = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token) {
            alert('로그인이 필요합니다.');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/v1/board', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ title: newTitle, content: newContent })
            });

            if (res.ok) {
                setIsCreating(false);
                setNewTitle('');
                setNewContent('');
                fetchPosts();
            } else {
                alert('게시글 작성 실패');
            }
        } catch (error) {
            console.error(error);
            alert('서버 오류');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdatePost = async (id: number) => {
        if (!token) {
            alert('로그인이 필요합니다.');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`/api/v1/board/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ title: editTitle, content: editContent })
            });

            if (res.ok) {
                setEditingId(null);
                setEditTitle('');
                setEditContent('');
                fetchPosts();
            } else {
                alert('게시글 수정 실패 (본인 글만 수정 가능합니다)');
            }
        } catch (error) {
            console.error(error);
            alert('서버 오류');
        } finally {
            setLoading(false);
        }
    };

    const handleDeletePost = async (id: number) => {
        if (!token) return;
        if (!confirm('정말 삭제하시겠습니까?')) return;

        try {
            const res = await fetch(`/api/v1/board/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (res.ok) {
                fetchPosts();
            } else {
                alert('삭제 실패 (본인 글만 삭제 가능합니다)');
            }
        } catch (error) {
            console.error(error);
        }
    };

    const startEditing = (post: Post) => {
        setEditingId(post.id);
        setEditTitle(post.title);
        setEditContent(post.content);
        setExpandedId(null);
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditTitle('');
        setEditContent('');
    };

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

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900">공지사항 및 게시판</h2>
                    <p className="text-gray-600 mt-1">사내 소식과 의견을 공유하세요</p>
                </div>
                <button
                    onClick={() => setIsCreating(true)}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors shadow-md hover:shadow-lg"
                >
                    <Plus className="w-5 h-5" />
                    새 글 작성
                </button>
            </div>

            {isCreating && (
                <div className="mb-8 bg-white p-8 rounded-xl shadow-lg border border-gray-200">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-gray-900">새 게시글 작성</h3>
                        <button
                            onClick={() => setIsCreating(false)}
                            className="text-gray-400 hover:text-gray-600"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                    <form onSubmit={handleCreatePost} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">제목</label>
                            <input
                                type="text"
                                placeholder="게시글 제목을 입력하세요"
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">내용</label>
                            <ReactQuill
                                theme="snow"
                                value={newContent}
                                onChange={setNewContent}
                                modules={modules}
                                formats={formats}
                                className="bg-white rounded-lg"
                                placeholder="내용을 입력하세요..."
                            />
                        </div>
                        <div className="flex gap-3 justify-end pt-4">
                            <button
                                type="button"
                                onClick={() => setIsCreating(false)}
                                className="px-6 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium"
                            >
                                취소
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium shadow-md"
                            >
                                {loading ? '등록 중...' : '등록하기'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="space-y-4">
                {posts.map((post) => (
                    <div key={post.id} className="bg-white rounded-xl shadow-md border border-gray-200 hover:shadow-lg transition-all overflow-hidden">
                        {editingId === post.id ? (
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
                                        <label className="block text-sm font-medium text-gray-700 mb-2">제목</label>
                                        <input
                                            type="text"
                                            value={editTitle}
                                            onChange={(e) => setEditTitle(e.target.value)}
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">내용</label>
                                        <ReactQuill
                                            theme="snow"
                                            value={editContent}
                                            onChange={setEditContent}
                                            modules={modules}
                                            formats={formats}
                                            className="bg-white"
                                        />
                                    </div>
                                    <div className="flex gap-3 justify-end pt-4">
                                        <button
                                            onClick={cancelEditing}
                                            className="px-6 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium"
                                        >
                                            취소
                                        </button>
                                        <button
                                            onClick={() => handleUpdatePost(post.id)}
                                            disabled={loading}
                                            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium flex items-center gap-2 shadow-md"
                                        >
                                            <Save className="w-4 h-4" />
                                            {loading ? '저장 중...' : '저장하기'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            // View Mode
                            <div>
                                <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-transparent">
                                    <div className="flex justify-between items-start">
                                        <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                                            <MessageSquare className="w-6 h-6 text-blue-600" />
                                            {post.title}
                                        </h3>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => startEditing(post)}
                                                className="text-gray-500 hover:text-blue-600 transition-colors p-2 hover:bg-blue-50 rounded-lg"
                                                title="수정"
                                            >
                                                <Edit className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => handleDeletePost(post.id)}
                                                className="text-gray-500 hover:text-red-600 transition-colors p-2 hover:bg-red-50 rounded-lg"
                                                title="삭제"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 mt-3 text-sm text-gray-600">
                                        <span className="flex items-center gap-1">
                                            <span className="font-medium">작성자:</span> {post.author_name}
                                        </span>
                                        <span className="text-gray-400">•</span>
                                        <span>{new Date(post.created_at).toLocaleDateString('ko-KR', { 
                                            year: 'numeric', 
                                            month: 'long', 
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}</span>
                                    </div>
                                </div>
                                <div className="p-6">
                                    {expandedId === post.id ? (
                                        <div>
                                            <div 
                                                className="prose max-w-none mb-4"
                                                dangerouslySetInnerHTML={{ __html: post.content }}
                                            />
                                            <button
                                                onClick={() => setExpandedId(null)}
                                                className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 text-sm"
                                            >
                                                <Eye className="w-4 h-4" />
                                                접기
                                            </button>
                                        </div>
                                    ) : (
                                        <div>
                                            <div 
                                                className="prose max-w-none line-clamp-3 mb-4 text-gray-600"
                                                dangerouslySetInnerHTML={{ __html: post.content }}
                                            />
                                            <button
                                                onClick={() => setExpandedId(post.id)}
                                                className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 text-sm"
                                            >
                                                <Eye className="w-4 h-4" />
                                                더보기
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
                {posts.length === 0 && (
                    <div className="text-center py-20 bg-white rounded-xl shadow-sm border border-gray-200">
                        <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500 text-lg">게시글이 없습니다.</p>
                        <p className="text-gray-400 text-sm mt-2">첫 번째 글을 작성해보세요!</p>
                    </div>
                )}
            </div>
        </div>
    );
}
