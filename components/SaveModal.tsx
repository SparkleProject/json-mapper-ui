import React, { useState, useEffect, useRef } from 'react';

interface SaveModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (name: string) => void;
    defaultName: string;
}

const SaveModal: React.FC<SaveModalProps> = ({ isOpen, onClose, onSave, defaultName }) => {
    const [name, setName] = useState(defaultName);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setName(defaultName);
            // Focus input after a short delay to allow render
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen, defaultName]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            onSave(name.trim());
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 transform transition-all scale-100">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-slate-800">Save Session</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label htmlFor="sessionName" className="block text-sm font-medium text-slate-700 mb-1">
                            Session Name
                        </label>
                        <input
                            ref={inputRef}
                            type="text"
                            id="sessionName"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Enter session name..."
                            autoComplete="off"
                        />
                    </div>

                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-md font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-slate-800 text-white hover:bg-slate-700 rounded-md font-medium transition-colors shadow-sm flex items-center gap-2"
                        >
                            <i className="fas fa-save"></i> Save
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SaveModal;
