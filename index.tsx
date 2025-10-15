/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo, ChangeEvent, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";

// --- SUPABASE & GEMINI SETUP ---
const SUPABASE_URL = "https://fgpzuamjdppftszzxqxh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZncHp1YW1qZHBwZnRzenp4cXhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzNzgzMzksImV4cCI6MjA3NTk1NDMzOX0.ZD24cq7Vm29whlQgRGwhwFt4Y6ISNXTuGQZQI9cy8hg";

const supabase = (self as any).supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- HELPER FUNCTIONS ---
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = error => reject(error);
  });
}

// --- TYPE DEFINITIONS ---
// FIX: Moved type definitions to the top level to be accessible by all components.
// Defines the structure of a CV object, including backend fields and client-side status.
type CV = {
  id: number;
  created_at: string; // For sorting by upload date
  is_processing: boolean;
  extracted_data: any;
  status?: 'queued' | 'processing';
  // FIX: Added optional folders property to correctly type search results from Supabase.
  folders?: Folder;
  is_starred?: boolean; // Client-side flag for favorite status
  file_path: string; // Add file_path to CV type
  comments?: Comment[]; // To hold comments for display on the card
  [key: string]: any; // Allows for other properties from the database.
};

// FIX: Define a type for Folder objects to ensure type safety.
type Folder = {
    id: number;
    name: string;
    [key: string]: any; // Allows for other properties from the database.
};

type Notification = {
  id: number;
  message: string;
  type: 'success' | 'error';
};

// FIX: Define a type for uploaded CVs with their corresponding File object to ensure type safety in the upload and processing flow.
type UploadedCVWithFile = {
    cvData: CV;
    file: File;
};

type Comment = {
    id: number;
    created_at: string;
    content: string;
    cv_id: number;
    user_id: string;
    user_email: string;
};

// --- COMPONENTS ---

const Spinner = () => <div className="spinner"></div>;

const Notification: React.FC<{ notification: Notification; onClose: (id: number) => void; }> = ({ notification, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose(notification.id);
        }, 5000); // Auto-dismiss after 5 seconds

        return () => clearTimeout(timer);
    }, [notification.id, onClose]);

    const icon = notification.type === 'success' ? 'check_circle' : 'error';

    return (
        <div className={`notification notification-${notification.type}`} role="alert">
            <span className="material-symbols-outlined">{icon}</span>
            <p className="notification-message">{notification.message}</p>
            <button onClick={() => onClose(notification.id)} className="notification-close-btn" aria-label="Close notification">
                <span className="material-symbols-outlined">close</span>
            </button>
        </div>
    );
};

// FIX: Add explicit prop types to ensure type