import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Box,
  Alert,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  InputAdornment,
  CircularProgress,
  Divider,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ArrowBackIcon, SaveIcon } from '@mui/icons-material';

interface LoanEditData {
  principal: number;
  interestRate: number;
  termMonths: number;
  loanType: 'fixed' | 'variable' | 'interest-only' | 'balloon';
  balloonMonths?: number;
  startDate: Date;
  paymentDueDay: number;
  status: string;
  notes?: string;
}

const EditLoanPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [loan, setLoan] = useState<LoanEditData>({
    principal: 0,
    interestRate: 0,
    termMonths: 0,
    loanType: 'fixed',
    startDate: new Date(),
    paymentDueDay: 1,
    status: 'ACTIVE',
  });

  const [originalLoan, setOriginalLoan] = useState<LoanEditData | null>(null);

  useEffect(() => {
    fetchLoan();
  }, [id]);

  const fetchLoan = async () => {
    try {
      const response = await fetch(`/api/loans/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch loan');
      }
      
      const data = await response.json();
      const loanData: LoanEditData = {
        principal: data.principal || data.originalPrincipal,
        interestRate: data.interestRate || data.annualRate,
        termMonths: data.termMonths,
        loanType: data.loanType || 'fixed',
        balloonMonths: data.balloonMonths,
        startDate: new Date(data.startDate),
        paymentDueDay: data.paymentDueDay || 1,
        status: data.status || 'ACTIVE',
        notes: data.notes,
      };
      
      setLoan(loanData);
      setOriginalLoan(loanData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Create a modification request
      const modificationData = {
        loanId: id,
        modificationType: 'TERMS_CHANGE',
        changes: {},
        reason: 'Manual loan edit',
        effectiveDate: new Date().toISOString(),
      };

      // Only include changed fields
      if (loan.interestRate !== originalLoan?.interestRate) {
        modificationData.changes.interestRate = loan.interestRate;
      }
      if (loan.termMonths !== originalLoan?.termMonths) {
        modificationData.changes.termMonths = loan.termMonths;
      }
      if (loan.paymentDueDay !== originalLoan?.paymentDueDay) {
        modificationData.changes.paymentDueDay = loan.paymentDueDay;
      }
      if (loan.status !== originalLoan?.status) {
        modificationData.changes.status = loan.status;
      }
      if (loan.notes !== originalLoan?.notes) {
        modificationData.changes.notes = loan.notes;
      }

      // Only proceed if there are changes
      if (Object.keys(modificationData.changes).length === 0) {
        setError('No changes detected');
        setSaving(false);
        return;
      }

      const response = await fetch('/api/loans/modifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(modificationData),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save loan modifications');
      }
      
      setSuccess('Loan updated successfully!');
      
      // Redirect back to loan details after 2 seconds
      setTimeout(() => {
        navigate(`/loans/${id}`);
      }, 2000);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = () => {
    if (!originalLoan) return false;
    
    return (
      loan.interestRate !== originalLoan.interestRate ||
      loan.termMonths !== originalLoan.termMonths ||
      loan.paymentDueDay !== originalLoan.paymentDueDay ||
      loan.status !== originalLoan.status ||
      loan.notes !== originalLoan.notes
    );
  };

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ mb: 4 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(`/loans/${id}`)}
          sx={{ mb: 2 }}
        >
          Back to Loan Details
        </Button>
        
        <Typography variant="h4" gutterBottom>
          Edit Loan
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Modify loan terms and details
        </Typography>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {success}
        </Alert>
      )}
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Loan Terms
              </Typography>
              
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Principal Amount"
                    type="number"
                    value={loan.principal}
                    disabled
                    InputProps={{
                      startAdornment: <InputAdornment position="start">$</InputAdornment>,
                    }}
                    helperText="Principal amount cannot be changed"
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Interest Rate"
                    type="number"
                    value={loan.interestRate}
                    onChange={(e) => setLoan({ ...loan, interestRate: Number(e.target.value) })}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">%</InputAdornment>,
                    }}
                    inputProps={{ step: 0.125 }}
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Term"
                    type="number"
                    value={loan.termMonths}
                    onChange={(e) => setLoan({ ...loan, termMonths: Number(e.target.value) })}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">months</InputAdornment>,
                    }}
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Loan Type</InputLabel>
                    <Select
                      value={loan.loanType}
                      label="Loan Type"
                      disabled
                    >
                      <MenuItem value="fixed">Fixed Rate</MenuItem>
                      <MenuItem value="variable">Variable Rate</MenuItem>
                      <MenuItem value="interest-only">Interest Only</MenuItem>
                      <MenuItem value="balloon">Balloon</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <DatePicker
                      label="Start Date"
                      value={loan.startDate}
                      disabled
                      renderInput={(params) => <TextField {...params} fullWidth />}
                    />
                  </LocalizationProvider>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Payment Due Day"
                    type="number"
                    value={loan.paymentDueDay}
                    onChange={(e) => setLoan({ ...loan, paymentDueDay: Number(e.target.value) })}
                    inputProps={{ min: 1, max: 31 }}
                    helperText="Day of month (1-31)"
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={loan.status}
                      onChange={(e) => setLoan({ ...loan, status: e.target.value })}
                      label="Status"
                    >
                      <MenuItem value="ACTIVE">Active</MenuItem>
                      <MenuItem value="DELINQUENT">Delinquent</MenuItem>
                      <MenuItem value="DEFAULTED">Defaulted</MenuItem>
                      <MenuItem value="PAID_OFF">Paid Off</MenuItem>
                      <MenuItem value="FORBEARANCE">Forbearance</MenuItem>
                      <MenuItem value="DEFERMENT">Deferment</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Notes"
                    multiline
                    rows={4}
                    value={loan.notes || ''}
                    onChange={(e) => setLoan({ ...loan, notes: e.target.value })}
                    placeholder="Add any notes about this loan modification..."
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Edit Summary
              </Typography>
              
              {hasChanges() ? (
                <>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Changes Made:
                  </Typography>
                  <Box sx={{ mb: 2 }}>
                    {loan.interestRate !== originalLoan?.interestRate && (
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        • Interest Rate: {originalLoan?.interestRate}% → {loan.interestRate}%
                      </Typography>
                    )}
                    {loan.termMonths !== originalLoan?.termMonths && (
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        • Term: {originalLoan?.termMonths} → {loan.termMonths} months
                      </Typography>
                    )}
                    {loan.paymentDueDay !== originalLoan?.paymentDueDay && (
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        • Payment Due Day: {originalLoan?.paymentDueDay} → {loan.paymentDueDay}
                      </Typography>
                    )}
                    {loan.status !== originalLoan?.status && (
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        • Status: {originalLoan?.status} → {loan.status}
                      </Typography>
                    )}
                    {loan.notes !== originalLoan?.notes && (
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        • Notes updated
                      </Typography>
                    )}
                  </Box>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No changes made yet
                </Typography>
              )}
              
              <Divider sx={{ my: 2 }} />
              
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant="contained"
                  color="primary"
                  fullWidth
                  startIcon={<SaveIcon />}
                  onClick={handleSave}
                  disabled={!hasChanges() || saving}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => navigate(`/loans/${id}`)}
                >
                  Cancel
                </Button>
              </Box>
            </CardContent>
          </Card>
          
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Important Notes
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                • Changes to loan terms will create a modification record for audit purposes
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                • Interest rate changes will affect future payments
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                • Term extensions may require additional approvals
              </Typography>
              <Typography variant="body2" color="text.secondary">
                • All modifications are tracked in the loan history
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
};

export default EditLoanPage;