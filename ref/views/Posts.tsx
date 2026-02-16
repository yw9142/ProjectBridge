import React from 'react';
import { MOCK_POSTS } from '../services/mockData';
import { StatusBadge } from '../components/StatusBadge';
import { MessageSquare, Pin } from 'lucide-react';

export const Posts: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">Communication</h2>
        <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition">
          New Post
        </button>
      </div>

      <div className="space-y-4">
        {MOCK_POSTS.map((post) => (
          <div key={post.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-300 transition cursor-pointer">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-3">
                <StatusBadge status={post.type} />
                {post.pinned && <Pin className="w-4 h-4 text-slate-400 rotate-45" />}
              </div>
              <span className="text-xs text-slate-400">{new Date(post.createdAt).toLocaleDateString()}</span>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">{post.title}</h3>
            <p className="text-slate-600 text-sm mb-4 line-clamp-2">{post.body}</p>
            
            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-slate-200 overflow-hidden">
                    {post.author.avatar && <img src={post.author.avatar} alt="avatar" />}
                </div>
                <span className="text-xs font-medium text-slate-700">{post.author.name}</span>
              </div>
              <div className="flex items-center gap-1 text-slate-400 text-xs">
                <MessageSquare className="w-4 h-4" />
                <span>{post.commentCount} comments</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};