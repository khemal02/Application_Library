import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TablePagination from '@mui/material/TablePagination';
import Paper from '@mui/material/Paper';
import LinearProgress from '@mui/material/LinearProgress';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

/**
 * Server-driven data table: pagination/sort state lives with the caller (which owns the API
 * query), this component only renders what it's given and reports interaction intents up.
 */
export default function DataTable({
  columns, rows, pagination, onPageChange, onRowsPerPageChange, onRowClick, loading, emptyMessage = 'No records found',
}) {
  return (
    <Paper variant="outlined" sx={{ width: '100%', overflow: 'hidden' }}>
      {loading && <LinearProgress />}
      <TableContainer sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {columns.map((col) => (
                <TableCell key={col.key} sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {col.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={columns.length}>
                  <Box sx={{ py: 4, textAlign: 'center' }}>
                    <Typography color="text.secondary">{emptyMessage}</Typography>
                  </Box>
                </TableCell>
              </TableRow>
            )}
            {rows.map((row) => (
              <TableRow
                key={row.id}
                hover={!!onRowClick}
                onClick={() => onRowClick?.(row)}
                tabIndex={onRowClick ? 0 : undefined}
                role={onRowClick ? 'button' : undefined}
                onKeyDown={onRowClick ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onRowClick(row);
                  }
                } : undefined}
                sx={{
                  cursor: onRowClick ? 'pointer' : 'default',
                  ...(onRowClick ? { '&:focus-visible': { outline: '2px solid', outlineOffset: '-2px', outlineColor: 'primary.main' } } : {}),
                }}
              >
                {columns.map((col) => (
                  <TableCell key={col.key}>{col.render ? col.render(row) : row[col.key]}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {pagination && (
        <TablePagination
          component="div"
          count={pagination.totalItems}
          page={pagination.page - 1}
          rowsPerPage={pagination.limit}
          onPageChange={(e, newPage) => onPageChange(newPage + 1)}
          onRowsPerPageChange={(e) => onRowsPerPageChange(Number(e.target.value))}
          rowsPerPageOptions={[10, 20, 50, 100]}
        />
      )}
    </Paper>
  );
}
