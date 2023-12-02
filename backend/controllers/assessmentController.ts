import { Request, Response } from 'express';
import {
  getAssessmentById,
  updateAssessmentResultMarkerById,
  uploadAssessmentResultsById,
} from '../services/assessmentService';
import { NotFoundError } from '../services/errors';

export const getAssessment = async (req: Request, res: Response) => {
  try {
    const { assessmentId } = req.params;
    const assessment = await getAssessmentById(assessmentId);
    res.status(200).json(assessment);
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).json({ error: error.message });
    } else {
      console.error('Error retrieving assessment:', error);
      res.status(500).json({ error: 'Failed to retrieve assessment' });
    }
  }
};

export const uploadResults = async (req: Request, res: Response) => {
  try {
    const { assessmentId } = req.params;
    const results = req.body.items;
    await uploadAssessmentResultsById(assessmentId, results);
    res.status(200).json({ message: 'Results uploaded successfully' });
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).json({ error: error.message });
    } else {
      console.error('Error retrieving assessment:', error);
      res.status(500).json({ error: 'Failed to retrieve assessment' });
    }
  }
};

export const updateResultMarker = async (req: Request, res: Response) => {
  try {
    const { assessmentId, resultId } = req.params;
    const { markerId } = req.body;
    await updateAssessmentResultMarkerById(assessmentId, resultId, markerId);
    res.status(200).json({ message: 'Marker updated successfully' });
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).json({ error: error.message });
    } else {
      console.error('Error retrieving assessment:', error);
      res.status(500).json({ error: 'Failed to retrieve assessment' });
    }
  }
};
