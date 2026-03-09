import React, { useState, useRef } from 'react';
import { User, Briefcase, FileText, Image as ImageIcon, ArrowRight, Upload } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { updateMe } from '../api/users';
import { apiUploadFile } from '../api/client';
import { toast } from 'sonner';

export const Onboarding = () => {
  const [professionalTitle, setProfessionalTitle] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const handleSkip = () => {
    navigate('/dashboard', { replace: true });
  };

  const handleSave = async () => {
    setSubmitting(true);
    try {
      let finalAvatarUrl: string | undefined = avatarUrl.trim() || undefined;
      if (avatarFile) {
        const { url } = await apiUploadFile(avatarFile);
        finalAvatarUrl = url;
      }
      const user = await updateMe({
        professionalTitle: professionalTitle.trim() || undefined,
        bio: bio.trim() || undefined,
        avatarUrl: finalAvatarUrl,
      });
      setUser(user);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file (e.g. JPG, PNG)');
      return;
    }
    setAvatarFile(file);
    setAvatarUrl('');
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const clearAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
    setAvatarUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen bg-brand-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-xl bg-white rounded-[3rem] shadow-2xl border border-brand-100 p-8 md:p-12">
        <h1 className="text-3xl font-black text-brand-700 mb-2">Complete your profile</h1>
        <p className="text-brand-400 font-medium mb-8">Optional: add a title, bio, and profile picture.</p>

        <div className="space-y-6">
          <div>
            <label className="block text-xs font-black text-brand-400 uppercase tracking-widest mb-2">Professional title</label>
            <div className="relative">
              <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-300" />
              <input
                type="text"
                value={professionalTitle}
                onChange={(e) => setProfessionalTitle(e.target.value)}
                placeholder="e.g. Creative Director"
                className="w-full pl-12 pr-4 py-4 bg-brand-50 border-2 border-transparent rounded-2xl focus:border-brand-700 focus:bg-white transition-all outline-none font-bold text-brand-700"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-brand-400 uppercase tracking-widest mb-2">Bio</label>
            <div className="relative">
              <FileText className="absolute left-4 top-4 w-5 h-5 text-brand-300" />
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="A short bio about yourself..."
                className="w-full pl-12 pr-4 py-4 bg-brand-50 border-2 border-transparent rounded-2xl focus:border-brand-700 focus:bg-white transition-all outline-none font-bold text-brand-700 resize-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-brand-400 uppercase tracking-widest mb-2">Profile picture</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            {avatarPreview || avatarUrl ? (
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-brand-200 bg-brand-50 shrink-0">
                  <img
                    src={avatarPreview || avatarUrl}
                    alt="Profile preview"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-brand-100 text-brand-700 font-bold rounded-xl hover:bg-brand-200 transition-colors cursor-pointer flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" /> Change photo
                  </button>
                  <button
                    type="button"
                    onClick={clearAvatar}
                    className="text-brand-400 font-bold text-sm hover:text-brand-600 cursor-pointer"
                  >
                    Remove photo
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-3 pl-12 pr-4 py-8 bg-brand-50 border-2 border-dashed border-brand-200 rounded-2xl hover:border-brand-400 hover:bg-brand-100 transition-all cursor-pointer"
              >
                <ImageIcon className="w-8 h-8 text-brand-400" />
                <span className="font-bold text-brand-600">Upload from computer</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mt-10">
          <button
            type="button"
            onClick={handleSkip}
            className="flex-1 py-4 bg-brand-50 text-brand-700 font-black rounded-2xl hover:bg-brand-100 transition-all cursor-pointer"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={submitting}
            className="flex-[2] py-4 bg-brand-700 text-white font-black rounded-2xl hover:bg-brand-600 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
          >
            Save and continue <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
