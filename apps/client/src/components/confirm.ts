import Swal from 'sweetalert2';

export async function confirmAction(title: string, text: string, confirmButtonText = 'Onayla') {
  const result = await Swal.fire({
    title,
    text,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText: 'İptal',
    reverseButtons: true,
    confirmButtonColor: '#123f61',
    cancelButtonColor: '#64748b',
  });
  return result.isConfirmed;
}
